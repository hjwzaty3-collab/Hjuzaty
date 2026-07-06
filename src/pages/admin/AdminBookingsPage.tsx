import { useState, useEffect } from 'react';
import { Search, Calendar, Clock, MapPin, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: 'معلق',   color: 'text-amber-600 bg-amber-50 border-amber-100' },
  confirmed: { label: 'مؤكد',   color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  completed: { label: 'مكتمل', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  cancelled: { label: 'ملغي',  color: 'text-red-500 bg-red-50 border-red-100' },
};

const TABS = [
  { id: 'all',       label: 'الكل',      filter: () => true },
  { id: 'pending',   label: 'المعلقة',   filter: (b: any) => b.status === 'pending' },
  { id: 'confirmed', label: 'المؤكدة',  filter: (b: any) => b.status === 'confirmed' },
  { id: 'completed', label: 'المكتملة', filter: (b: any) => b.status === 'completed' },
  { id: 'cancelled', label: 'الملغية',  filter: (b: any) => b.status === 'cancelled' },
];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchBookings();
    const ch = supabase.channel(`admin-bookings-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      // Use SECURITY DEFINER RPC to bypass RLS
      const { data, error } = await supabase.rpc('admin_get_all_bookings');
      if (error) { console.error('admin_get_all_bookings:', error.message); return; }
      setBookings((data || []).map((b: any) => ({
        id: b.id,
        patientName: b.patient_name || 'مريض',
        doctorName: b.doctor_name || 'طبيب',
        date: b.booking_date,
        time: b.start_time,
        status: (b.status || 'pending').toLowerCase(),
        price: b.price || 0,
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      await supabase.from('bookings').update({ status }).eq('id', id);
      toast.success('تم تحديث الحالة ✓');
      fetchBookings();
    } catch (e) { toast.error('فشل التحديث'); }
  };

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const filtered = bookings.filter(b =>
    (b.patientName.includes(searchQuery) || b.doctorName.includes(searchQuery)) &&
    currentTab.filter(b)
  );

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="ابحث عن مريض أو طبيب..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-11 pr-11 pl-4 rounded-2xl border-2 border-slate-100 bg-white text-slate-800 font-medium placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-400 transition-all w-64" />
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">إدارة الحجوزات</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">{bookings.length} حجز إجمالاً</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit flex-wrap">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab.label}
            <span className={`mr-2 text-[10px] font-black ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}>
              {bookings.filter(b => tab.filter(b)).length}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">جاري تحميل الحجوزات...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-3xl flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-500 font-bold">لا توجد حجوزات في هذه الفئة</p>
            </div>
          ) : filtered.map(b => {
            const st = STATUS_MAP[b.status] || STATUS_MAP['pending'];
            return (
              <div key={b.id} className="bg-white rounded-3xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all p-5">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-base flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                    {b.patientName.charAt(0)}
                  </div>
                  <div className="flex-1 text-right">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border ${st.color}`}>{st.label}</span>
                        {b.price > 0 && <span className="text-xs font-black text-slate-600">{b.price.toLocaleString()} د.ع</span>}
                      </div>
                      <div>
                        <p className="font-black text-slate-900">{b.patientName}</p>
                        <p className="text-xs text-indigo-600 font-bold mt-0.5">مع {b.doctorName}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-400 font-bold justify-end">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{b.date}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.time}</span>
                    </div>
                    {b.status === 'pending' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-50 justify-start">
                        <button onClick={() => updateStatus(b.id, 'cancelled')}
                          className="flex items-center gap-1.5 text-xs font-bold text-red-500 border border-red-100 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors">
                          <XCircle className="w-3.5 h-3.5" />رفض
                        </button>
                        <button onClick={() => updateStatus(b.id, 'confirmed')}
                          className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl hover:opacity-90 transition-all"
                          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                          <CheckCircle2 className="w-3.5 h-3.5" />تأكيد
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
