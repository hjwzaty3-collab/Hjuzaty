import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, CheckCircle2, XCircle, Search, Loader2, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { notifyAppointmentStatus } from '@/services/notificationService';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:   { label: 'معلق',   color: 'text-amber-600 bg-amber-50 border-amber-100' },
  CONFIRMED: { label: 'مؤكد',   color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  COMPLETED: { label: 'مكتمل', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  CANCELLED: { label: 'ملغي',  color: 'text-red-500 bg-red-50 border-red-100' },
};

const TABS = [
  { id: 'active',    label: 'النشطة',   filter: (b: any) => ['PENDING', 'CONFIRMED'].includes(b.status) },
  { id: 'completed', label: 'المكتملة', filter: (b: any) => b.status === 'COMPLETED' },
  { id: 'cancelled', label: 'الملغية',  filter: (b: any) => b.status === 'CANCELLED' },
];

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export default function DoctorBookingsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  useEffect(() => {
    if (!user) return;
    fetchBookings();

    if (!isValidUUID(user.id)) return;

    // Unique suffix prevents StrictMode double-mount from reusing the same channel
    const suffix = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`dr-bookings-${user.id}-${suffix}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookings',
        filter: `doctor_id=eq.${user.id}`,
      }, fetchBookings)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);


  const fetchBookings = async () => {
    if (!user) return;
    try {
      if (!isValidUUID(user.id)) { setBookings([]); return; }

      // Use SECURITY DEFINER RPC — works for anon (custom-login) doctors
      const { data, error } = await supabase
        .rpc('get_doctor_bookings', { p_doctor_id: user.id });

      if (error) throw error;

      setBookings((data || []).map((b: any) => ({
        id: b.id,
        patientId: b.patient_id,
        patientName: b.patient_name || 'مريض',
        date: b.booking_date,
        time: b.start_time,
        status: (b.status || 'pending').toUpperCase(),
        type: b.notes || 'استشارة',
        clinic: 'العيادة',
      })));
    } catch (e) {
      console.error('get_doctor_bookings error:', e);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (bookingId: string, patientId: string, status: string) => {
    try {
      // Use SECURITY DEFINER RPC for anon doctors
      const { error } = await supabase.rpc('update_booking_status', {
        p_booking_id: bookingId,
        p_doctor_id:  user!.id,
        p_status:     status,
      });
      if (error) throw error;

      // Notify patient & admin
      try {
        await notifyAppointmentStatus(patientId, bookingId, status, 'DOCTOR', true);
      } catch (_) {}

      fetchBookings();
    } catch (e) {
      console.error('update_booking_status error:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-medium text-sm">جاري تحميل الحجوزات...</p>
      </div>
    );
  }

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const filtered = bookings.filter(b =>
    b.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) &&
    currentTab.filter(b)
  );

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث عن مريض..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-11 pr-11 pl-4 rounded-2xl border-2 border-slate-100 bg-white text-slate-800 font-medium placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-400 transition-all w-56"
          />
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">الحجوزات</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">{bookings.length} حجز إجمالاً</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab.label}
            <span className={`mr-2 text-[10px] font-black ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}>
              {bookings.filter(b => tab.filter(b)).length}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
              <Calendar className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-slate-500 font-bold">لا توجد حجوزات في هذه الفئة</p>
            {!isValidUUID(user?.id || '') && (
              <p className="text-xs text-slate-400 mt-2 max-w-xs">
                الحساب التجريبي لا يحتوي على حجوزات حقيقية. استخدم حساباً حقيقياً من Supabase.
              </p>
            )}
          </div>
        ) : filtered.map((booking) => {
          const st = STATUS_MAP[booking.status] || STATUS_MAP['PENDING'];
          return (
            <div
              key={booking.id}
              className="bg-white rounded-3xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              <div className="p-5 flex items-start gap-4">
                {/* Avatar */}
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-base flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                >
                  {booking.patientName.charAt(0)}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-black text-slate-900">{booking.patientName}</p>
                      <p className="text-xs text-indigo-600 font-bold mt-0.5">{booking.type}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border flex-shrink-0 ${st.color}`}>
                      {st.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 font-bold justify-start">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{booking.date}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{booking.time}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{booking.clinic}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                    <div className="flex gap-2">
                      {booking.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => updateStatus(booking.id, booking.patientId, 'CANCELLED')}
                            className="flex items-center gap-1.5 text-xs font-bold text-red-500 border border-red-100 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            رفض
                          </button>
                          <button
                            onClick={() => updateStatus(booking.id, booking.patientId, 'CONFIRMED')}
                            className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl transition-all hover:opacity-90"
                            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            تأكيد
                          </button>
                        </>
                      )}
                      {booking.status === 'CONFIRMED' && (
                        <button
                          onClick={() => navigate(`/doctor/medical-records?patient=${booking.patientName}&patientId=${booking.patientId}&bookingId=${booking.id}`)}
                          className="text-xs font-bold text-white px-4 py-2 rounded-xl hover:opacity-90 transition-all"
                          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                        >
                          بدء الزيارة
                        </button>
                      )}
                      {booking.status === 'COMPLETED' && (
                        <button
                          onClick={() => navigate(`/doctor/medical-records?patient=${booking.patientName}&patientId=${booking.patientId}`)}
                          className="text-xs font-bold text-indigo-600 border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
                        >
                          عرض السجل
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => navigate(`/doctor/messages?with=${booking.patientId}&name=${encodeURIComponent(booking.patientName)}`)}
                      className="w-8 h-8 rounded-xl bg-slate-50 text-indigo-500 hover:bg-indigo-50 flex items-center justify-center transition-colors"
                      title="مراسلة المريض"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
