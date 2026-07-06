import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, MessageSquare, XCircle, Loader2, RefreshCw, X, Building2, Phone, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { notifyAppointmentStatus } from '@/services/notificationService';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:   { label: 'معلق',   color: 'text-amber-600 bg-amber-50 border-amber-200' },
  confirmed: { label: 'مؤكد',   color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  completed: { label: 'مكتمل', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  cancelled: { label: 'ملغي',  color: 'text-red-500 bg-red-50 border-red-200' },
};

const TABS = [
  { id: 'upcoming',  label: 'القادمة',   filter: (b: any) => ['pending', 'confirmed'].includes(b.status) },
  { id: 'completed', label: 'المكتملة', filter: (b: any) => b.status === 'completed' },
  { id: 'cancelled', label: 'الملغية',  filter: (b: any) => b.status === 'cancelled' },
];

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export default function MyBookingsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  // Load Leaflet dynamically for Details Modal
  useEffect(() => {
    if (!selectedBooking?.clinicGoogleMapsLink) return;
    const match = selectedBooking.clinicGoogleMapsLink.match(/query=([-\d.]+),([-\d.]+)/);
    if (!match) return;

    if ((window as any).L) {
      initDetailsMap(parseFloat(match[1]), parseFloat(match[2]));
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.id = 'leaflet-css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.id = 'leaflet-js';
    script.onload = () => {
      initDetailsMap(parseFloat(match[1]), parseFloat(match[2]));
    };
    document.head.appendChild(script);
  }, [selectedBooking]);

  const initDetailsMap = (lat: number, lng: number) => {
    setTimeout(() => {
      const L = (window as any).L;
      if (!L) return;

      const container = L.DomUtil.get('details-map-container');
      if (container) {
        (container as any)._leaflet_id = null;
      }

      const map = L.map('details-map-container', { zoomControl: false }).setView([lat, lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      L.marker([lat, lng]).addTo(map);
      L.control.zoom({ position: 'topright' }).addTo(map);
    }, 150);
  };

  useEffect(() => {
    if (!user) return;
    fetchBookings();
    if (!isValidUUID(user.id)) return;
    const ch = supabase.channel(`patient-bk-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `patient_id=eq.${user.id}` }, fetchBookings)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const fetchBookings = async () => {
    if (!user) return;
    try {
      if (!isValidUUID(user.id)) { setBookings([]); return; }

      // Use SECURITY DEFINER RPC — works for anon (custom-login) patients
      const { data, error } = await supabase
        .rpc('get_patient_bookings', { p_patient_id: user.id });

      if (error) throw error;

      setBookings((data || []).map((b: any) => {
        let spec = b.doctor_spec;
        if (!spec && b.doctor_bio?.startsWith('التخصص:'))
          spec = b.doctor_bio.replace('التخصص:', '').split('\n')[0].trim();
        return {
          id: b.id, doctorId: b.doctor_id,
          doctorName: b.doctor_name || 'طبيب',
          specialization: spec || 'طبيب أخصائي',
          status: (b.status || 'pending').toLowerCase(),
          date: b.booking_date, time: b.start_time,
          price: b.price || 0,
          clinicName: b.clinic_name || 'العيادة الرئيسية',
          clinicAddress: b.clinic_address || '',
          clinicPhone: b.clinic_phone || '',
          clinicGoogleMapsLink: b.clinic_google_maps_link || '',
          notes: b.notes || '',
          createdAt: b.created_at,
        };
      }));
    } catch (e) { console.error('get_patient_bookings error:', e); }
    finally { setLoading(false); }
  };

  const handleCancel = async (id: string, doctorId: string) => {
    if (!user || !confirm('هل أنت متأكد من إلغاء هذا الحجز؟')) return;
    try {
      // Use SECURITY DEFINER RPC for anon patients
      const { error } = await supabase.rpc('cancel_booking', {
        p_booking_id: id,
        p_patient_id: user.id,
      });
      if (error) throw error;
      // Notify doctor & admin
      try {
        await notifyAppointmentStatus(doctorId, id, 'CANCELLED', 'PATIENT', true);
      } catch (_) {}
      toast.success('تم إلغاء الحجز');
      fetchBookings();
    } catch (e: any) { toast.error('فشل الإلغاء: ' + e.message); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-medium text-sm">جاري تحميل حجوزاتك...</p>
      </div>
    );
  }

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const filtered = bookings.filter(currentTab.filter);

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-400">{bookings.length} حجز إجمالاً</span>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">حجوزاتي</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">تابع مواعيدك الطبية</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {tab.label}
            <span className={`mr-2 text-[10px] font-black ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}>
              {bookings.filter(tab.filter).length}
            </span>
          </button>
        ))}
      </div>

      {/* Booking cards */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
              <Calendar className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-slate-500 font-bold">لا توجد حجوزات في هذه الفئة</p>
            {activeTab === 'upcoming' && (
              <button onClick={() => navigate('/doctors')}
                className="mt-4 text-sm font-bold text-white px-5 py-2.5 rounded-2xl hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                ابحث عن طبيب الآن
              </button>
            )}
          </div>
        ) : filtered.map(b => {
          const st = STATUS_MAP[b.status] || STATUS_MAP['pending'];
          return (
            <div
              key={b.id}
              onClick={() => setSelectedBooking(b)}
              className="bg-white rounded-3xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all overflow-hidden cursor-pointer text-right"
            >
              <div className="p-5 flex items-start gap-4">
                {/* Doctor avatar */}
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-xl flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                  {b.doctorName.charAt(0)}
                </div>
                <div className="flex-1 text-right min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-black text-slate-900">{b.doctorName}</p>
                      <p className="text-xs text-indigo-600 font-bold mt-0.5">{b.specialization}</p>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border flex-shrink-0 ${st.color}`}>{st.label}</span>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-slate-400 font-bold justify-start">
                    {b.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{b.date}</span>}
                    {b.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{b.time}</span>}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                    {b.price > 0 && (
                      <span className="text-sm font-black text-slate-800">{b.price.toLocaleString()} <span className="text-xs text-slate-400 font-bold">د.ع</span></span>
                    )}
                    <div className="flex gap-2">
                      {['pending', 'confirmed'].includes(b.status) && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleCancel(b.id, b.doctorId); }}
                            className="flex items-center gap-1.5 text-xs font-bold text-red-500 border border-red-100 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />إلغاء
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/messages?with=${b.doctorId}&name=${encodeURIComponent(b.doctorName)}`); }}
                            className="flex items-center gap-1.5 text-xs font-bold text-white px-3 py-2 rounded-xl hover:opacity-90 transition-all"
                            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />مراسلة
                          </button>
                        </>
                      )}
                      {b.status === 'completed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate('/doctors'); }}
                          className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 border border-indigo-100 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />إعادة حجز
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (() => {
        const st = STATUS_MAP[selectedBooking.status] || STATUS_MAP['pending'];
        const hasCoordinates = selectedBooking.clinicGoogleMapsLink && selectedBooking.clinicGoogleMapsLink.match(/query=([-\d.]+),([-\d.]+)/);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" dir="rtl">
            <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between text-right">
                <div>
                  <h3 className="font-black text-slate-800 text-lg">تفاصيل موعد الحجز</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">معلومات الطبيب والعيادة والموقع الجغرافي</p>
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6 text-right">
                {/* Doctor profile card */}
                <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 border border-slate-100">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-white text-2xl flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                    {selectedBooking.doctorName.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-lg">{selectedBooking.doctorName}</p>
                    <p className="text-sm text-indigo-600 font-bold mt-0.5">{selectedBooking.specialization}</p>
                  </div>
                  <span className={`text-xs font-black px-3 py-1.5 rounded-xl border flex-shrink-0 ${st.color}`}>
                    {st.label}
                  </span>
                </div>

                {/* Grid details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Right side: Time details */}
                  <div className="space-y-4">
                    <h4 className="font-black text-slate-800 text-sm border-r-4 border-indigo-500 pr-2">تفاصيل الموعد</h4>
                    
                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-3 justify-end">
                        <span className="text-sm font-bold text-slate-700">{selectedBooking.date}</span>
                        <span className="text-xs text-slate-400 font-black">التاريخ:</span>
                        <Calendar className="w-4 h-4 text-indigo-500" />
                      </div>
                      
                      <div className="flex items-center gap-3 justify-end">
                        <span className="text-sm font-bold text-slate-700">{selectedBooking.time}</span>
                        <span className="text-xs text-slate-400 font-black">الوقت:</span>
                        <Clock className="w-4 h-4 text-indigo-500" />
                      </div>

                      <div className="flex items-center gap-3 justify-end">
                        <span className="text-sm font-black text-slate-900">
                          {selectedBooking.price.toLocaleString()} د.ع
                        </span>
                        <span className="text-xs text-slate-400 font-black">كشفية العيادة:</span>
                        <Building2 className="w-4 h-4 text-indigo-500" />
                      </div>

                      {selectedBooking.createdAt && (
                        <div className="flex items-center gap-3 justify-end">
                          <span className="text-xs text-slate-500 font-medium">
                            {new Date(selectedBooking.createdAt).toLocaleString('ar-IQ')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-black">تاريخ الحجز:</span>
                        </div>
                      )}
                    </div>

                    {/* Patient Notes */}
                    {selectedBooking.notes && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider block">ملاحظات الحجز</span>
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-slate-700 text-sm leading-relaxed">
                          {selectedBooking.notes}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Left side: Clinic details & Location Map */}
                  <div className="space-y-4">
                    <h4 className="font-black text-slate-800 text-sm border-r-4 border-emerald-500 pr-2">معلومات العيادة</h4>

                    <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                      <div className="flex items-start gap-3 justify-end">
                        <div className="text-right flex-1">
                          <p className="text-sm font-black text-slate-800">{selectedBooking.clinicName}</p>
                          {selectedBooking.clinicAddress && (
                            <p className="text-xs text-slate-500 font-medium mt-0.5">{selectedBooking.clinicAddress}</p>
                          )}
                        </div>
                        <Building2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                      </div>

                      {selectedBooking.clinicPhone && (
                        <div className="flex items-center gap-3 justify-end">
                          <span className="text-sm font-bold text-slate-700" dir="ltr">{selectedBooking.clinicPhone}</span>
                          <Phone className="w-4 h-4 text-emerald-500" />
                        </div>
                      )}
                    </div>

                    {/* Leaflet Map Picker / Coordinates */}
                    <div className="space-y-2">
                      <span className="text-xs font-black text-slate-400 block">موقع العيادة الجغرافي</span>
                      {hasCoordinates ? (
                        <>
                          <div id="details-map-container" className="w-full h-[180px] rounded-2xl border border-slate-200 overflow-hidden shadow-inner bg-slate-100"></div>
                          <a
                            href={selectedBooking.clinicGoogleMapsLink}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full h-11 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all mt-2"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            فتح الموقع في خرائط جوجل (Google Maps)
                          </a>
                        </>
                      ) : (
                        <div className="h-[180px] bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                          <MapPin className="w-8 h-8 text-slate-300 mb-2" />
                          <p className="text-xs text-slate-500 font-bold">الموقع الجغرافي غير متوفر</p>
                          <p className="text-[10px] text-slate-400 mt-1">لم يتم إرفاق إحداثيات دقيقة لهذه العيادة</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
