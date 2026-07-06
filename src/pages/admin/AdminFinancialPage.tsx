import { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Calendar, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminFinancialPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, thisMonth: 0, totalBookings: 0, avgPerBooking: 0 });
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      // Use SECURITY DEFINER RPC to bypass RLS
      const { data, error } = await supabase.rpc('admin_get_all_bookings');
      if (error) { console.error('admin_get_all_bookings:', error.message); return; }
      if (!data) return;

      const completed = data.filter((b: any) => b.status === 'completed');
      const totalGross = completed.reduce((s: number, b: any) => s + (Number(b.price) || 0) + (Number(b.platform_fee) || 0), 0);
      const totalNet = completed.reduce((s: number, b: any) => s + (Number(b.platform_fee) || 0), 0);
      const totalDoctors = completed.reduce((s: number, b: any) => s + (Number(b.price) || 0), 0);

      setStats({
        totalRevenue: totalGross,
        thisMonth: totalNet,
        totalBookings: completed.length,
        avgPerBooking: totalDoctors,
      });

      setTransactions(data.slice(0, 20).map((b: any) => ({
        id: b.id || Math.random(),
        patient: b.patient_name || 'مريض',
        doctor: b.doctor_name || 'طبيب',
        date: b.booking_date,
        amount: (Number(b.price) || 0) + (Number(b.platform_fee) || 0),
        status: b.status,
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const STATS = [
    { label: 'إجمالي الإيرادات', value: `${stats.totalRevenue.toLocaleString()} د.ع`, icon: DollarSign, color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-100' },
    { label: 'صافي الإيرادات (المنصة)', value: `${stats.thisMonth.toLocaleString()} د.ع`, icon: TrendingUp, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-100' },
    { label: 'أرباح الأطباء', value: `${stats.avgPerBooking.toLocaleString()} د.ع`, icon: DollarSign, color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-100' },
    { label: 'حجوزات مكتملة', value: stats.totalBookings.toLocaleString(), icon: Calendar, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-100' },
  ];

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    completed: { label: 'مكتمل', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
    pending:   { label: 'معلق',  color: 'text-amber-600 bg-amber-50 border-amber-100' },
    confirmed: { label: 'مؤكد',  color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
    cancelled: { label: 'ملغي', color: 'text-red-500 bg-red-50 border-red-100' },
  };

  return (
    <div className="space-y-6 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
          <Download className="w-4 h-4" />
          تصدير التقرير
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">التقارير المالية</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">نظرة عامة على إيرادات المنصة</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(stat => (
          <div key={stat.label} className="bg-white rounded-3xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex-1 text-right">
              <p className="text-xs font-bold text-slate-400 uppercase">{stat.label}</p>
              <p className="text-lg font-black text-slate-900 mt-0.5">{stat.value}</p>
            </div>
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md ${stat.shadow} flex-shrink-0`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-50 text-right">
          <h2 className="font-black text-slate-900">سجل المعاملات</h2>
          <p className="text-xs text-slate-400 font-bold mt-0.5">آخر 20 حجز في النظام</p>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="w-7 h-7 text-indigo-500 animate-spin" />
            <p className="text-slate-500 font-medium text-sm">جاري تحميل البيانات...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-50">
                  {['المريض', 'الطبيب', 'التاريخ', 'المبلغ', 'الحالة'].map(h => (
                    <th key={h} className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {transactions.map(t => {
                  const st = STATUS_MAP[t.status] || STATUS_MAP['pending'];
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3 font-bold text-slate-900 text-sm">{t.patient}</td>
                      <td className="px-6 py-3 text-sm text-slate-600 font-medium">{t.doctor}</td>
                      <td className="px-6 py-3 text-sm text-slate-500">{t.date}</td>
                      <td className="px-6 py-3">
                        <span className="font-black text-slate-900 text-sm">{t.amount.toLocaleString()} <span className="text-xs text-slate-400 font-bold">د.ع</span></span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border ${st.color}`}>{st.label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
