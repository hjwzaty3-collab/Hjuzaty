import { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Building2, Phone, Edit2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

export default function ClinicsPage() {
  const user = useAuthStore((s) => s.user);
  const [clinics, setClinics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newClinic, setNewClinic] = useState({ name: '', address: '', phone: '', googleMapsLink: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Map Picker State
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    if (!mapOpen) return;

    // Check if Leaflet is already loaded
    if ((window as any).L) {
      initMap();
      return;
    }

    // Load Leaflet CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.id = 'leaflet-css';
    document.head.appendChild(link);

    // Load Leaflet JS
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.id = 'leaflet-js';
    script.onload = () => {
      initMap();
    };
    document.head.appendChild(script);
  }, [mapOpen]);

  const initMap = () => {
    setTimeout(() => {
      const L = (window as any).L;
      if (!L) return;

      const defaultLat = 33.3152;
      const defaultLng = 44.3661;
      
      const container = L.DomUtil.get('map-picker-container');
      if (container) {
        (container as any)._leaflet_id = null;
      }

      const map = L.map('map-picker-container').setView([defaultLat, defaultLng], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      let marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);

      const updateCoordinates = (lat: number, lng: number) => {
        const link = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        setNewClinic(prev => ({ ...prev, googleMapsLink: link }));
      };

      // Set initial value
      updateCoordinates(defaultLat, defaultLng);

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        updateCoordinates(lat, lng);
      });

      marker.on('dragend', (e: any) => {
        const { lat, lng } = marker.getLatLng();
        updateCoordinates(lat, lng);
      });
    }, 150);
  };

  useEffect(() => { if (user) fetchClinics(); }, [user]);

  const fetchClinics = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcErr } = await supabase
        .rpc('get_doctor_clinics', { p_doctor_id: user.id });

      if (rpcErr) {
        console.error('get_doctor_clinics error:', rpcErr.message);
        setError('فشل تحميل العيادات: ' + rpcErr.message);
        setClinics([]);
      } else {
        setClinics(data || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onAddClinic = async () => {
    if (!user || !newClinic.name.trim()) return;
    setSaving(true);
    try {
      const { error: rpcErr } = await supabase.rpc('add_clinic', {
        p_doctor_id: user.id,
        p_name:      newClinic.name.trim(),
        p_address:   newClinic.address.trim(),
        p_phone:     newClinic.phone.trim(),
        p_google_maps_link: newClinic.googleMapsLink || null,
      });

      if (rpcErr) throw new Error(rpcErr.message);

      toast.success('تمت إضافة العيادة ✓');
      setShowForm(false);
      setNewClinic({ name: '', address: '', phone: '', googleMapsLink: '' });
      fetchClinics();
    } catch (e: any) {
      console.error('add_clinic error:', e.message);
      toast.error('فشل إضافة العيادة: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (clinicId: string) => {
    if (!user || !confirm('هل أنت متأكد من حذف هذه العيادة؟')) return;
    try {
      const { error: rpcErr } = await supabase.rpc('delete_clinic', {
        p_clinic_id: clinicId,
        p_doctor_id: user.id,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      toast.success('تم حذف العيادة');
      fetchClinics();
    } catch (e: any) {
      toast.error('فشل الحذف: ' + e.message);
    }
  };

  const InputField = ({ label, placeholder, value, onChange, dir = 'rtl' }: any) => (
    <div className="space-y-1.5">
      <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">{label}</label>
      <input
        placeholder={placeholder}
        value={value}
        dir={dir}
        onChange={onChange}
        className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all"
      />
    </div>
  );

  return (
    <div className="space-y-6 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl transition-all hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
        >
          <Plus className="w-4 h-4" />
          إضافة عيادة
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">عياداتي</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">{clinics.length} عيادة مسجلة</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-right">
            <p className="text-sm font-black text-red-700">حدث خطأ</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
            <p className="text-xs text-red-400 mt-1">تأكد من تشغيل سكريبت SQL الجديد في Supabase</p>
          </div>
        </div>
      )}

      {/* Add Clinic Form */}
      {showForm && (
        <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-sm p-6 space-y-4 text-right">
          <h2 className="font-black text-slate-900">بيانات العيادة الجديدة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <InputField
              label="اسم العيادة *"
              placeholder="مثلاً: مركز رعاية العائلة"
              value={newClinic.name}
              onChange={(e: any) => setNewClinic({ ...newClinic, name: e.target.value })}
            />
            <InputField
              label="العنوان"
              placeholder="العنوان الكامل"
              value={newClinic.address}
              onChange={(e: any) => setNewClinic({ ...newClinic, address: e.target.value })}
            />
            <InputField
              label="رقم الهاتف"
              placeholder="+964 7XX XXX XXXX"
              dir="ltr"
              value={newClinic.phone}
              onChange={(e: any) => setNewClinic({ ...newClinic, phone: e.target.value })}
            />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1 text-right">
              <span className="text-xs text-slate-400 font-bold block mb-1.5">رابط خرائط جوجل (Google Maps Link)</span>
              <input
                placeholder="إلصق رابط مشاركة الموقع أو حدده من الخريطة"
                value={newClinic.googleMapsLink}
                onChange={(e: any) => setNewClinic({ ...newClinic, googleMapsLink: e.target.value })}
                className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-right"
              />
            </div>
            <button
              type="button"
              onClick={() => setMapOpen(true)}
              className="h-12 px-5 rounded-2xl border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-sm flex items-center gap-1.5 transition-all flex-shrink-0"
            >
              <MapPin className="w-4 h-4" />
              تحديد من الخريطة
            </button>
          </div>
          <div className="flex gap-3 justify-start pt-1">
            <button
              onClick={() => { setShowForm(false); setNewClinic({ name: '', address: '', phone: '', googleMapsLink: '' }); }}
              className="px-5 py-2.5 rounded-2xl border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all"
            >
              إلغاء
            </button>
            <button
              onClick={onAddClinic}
              disabled={saving || !newClinic.name.trim()}
              className="px-6 py-2.5 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
            >
              {saving ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />جاري الحفظ...</span>
              ) : 'حفظ العيادة'}
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">جاري تحميل العيادات...</p>
        </div>
      ) : clinics.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-5">
            <Building2 className="w-9 h-9 text-slate-300" />
          </div>
          <h3 className="text-lg font-black text-slate-700 mb-2">لا توجد عيادات بعد</h3>
          <p className="text-slate-400 font-medium text-sm mb-6">أضف عيادتك الأولى لتبدأ باستقبال الحجوزات</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-8 py-3 rounded-2xl font-black text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
          >
            إضافة أول عيادة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clinics.map((clinic) => (
            <div
              key={clinic.id}
              className="group bg-white rounded-3xl border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50 transition-all duration-200 overflow-hidden"
            >
              {/* Card header */}
              <div className="px-6 pt-6 pb-4 flex items-start justify-between">
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDelete(clinic.id)}
                    className="w-8 h-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)' }}
                >
                  <Building2 className="w-6 h-6 text-indigo-600" />
                </div>
              </div>

              {/* Card content */}
              <div className="px-6 pb-6 text-right space-y-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{clinic.name}</h3>
                  {clinic.address && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-500 font-medium mt-1.5 justify-end">
                      <span>{clinic.address}</span>
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </div>
                  )}
                  {clinic.google_maps_link && (
                    <div className="flex items-center gap-1.5 mt-2 justify-end">
                      <a
                        href={clinic.google_maps_link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1 transition-all"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        رابط الخريطة
                      </a>
                    </div>
                  )}
                </div>

                {clinic.phone && (
                  <div className="pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-sm font-bold text-slate-700" dir="ltr">{clinic.phone}</span>
                      <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                        <Phone className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map Picker Modal */}
      {mapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between text-right">
              <div>
                <h3 className="font-black text-slate-800 text-base">تحديد موقع العيادة على الخريطة</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">انقر على الخريطة أو اسحب العلامة لتحديد موقع العيادة</p>
              </div>
            </div>
            <div className="p-4 bg-slate-50 flex-1 min-h-[400px]">
              <div id="map-picker-container" className="w-full h-[400px] rounded-2xl border-2 border-slate-200 overflow-hidden shadow-inner"></div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setMapOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                تأكيد الموقع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
