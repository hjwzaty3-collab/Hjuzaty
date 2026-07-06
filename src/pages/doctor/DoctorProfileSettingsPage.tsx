import { useState, useEffect } from 'react';
import { User, Mail, Phone, Award, DollarSign, Save, Camera, Plus, Trash2, MapPin } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { IRAQI_GOVERNORATES } from '@/lib/constants';

const FIELD = ({ label, icon: Icon, type = 'text', value, onChange, placeholder = '', dir = 'rtl' }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">{label}</label>
    <div className="relative">
      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 flex items-center justify-center z-10">
        <Icon className="w-4 h-4" />
      </div>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        dir={dir}
        className="w-full h-13 pr-11 pl-5 py-3.5 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-right"
      />
    </div>
  </div>
);

export default function DoctorProfileSettingsPage() {
  const { user, setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState({ name: '', email: '', phone: '', specialization: '', price: '', bio: '', governorate: '' });
  const [clinics, setClinics] = useState<any[]>([]);
  const [showClinicForm, setShowClinicForm] = useState(false);
  const [newClinic, setNewClinic] = useState({ name: '', address: '', phone: '', googleMapsLink: '' });

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
      
      // Cleanup previous map instance if any
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

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        specialization: (user as any).specialization || '',
        price: (user as any).price || '',
        bio: (user as any).bio || '',
        governorate: user.governorate || '',
      });
      fetchClinics();
    }
  }, [user]);

  const fetchClinics = async () => {
    if (!user) return;
    const { data, error } = await supabase.rpc('get_doctor_clinics', { p_doctor_id: user.id });
    if (error) console.error('get_doctor_clinics:', error.message);
    if (data) setClinics(data);
  };

  const handleAddClinic = async () => {
    if (!user || !newClinic.name) return;
    try {
      const { error } = await supabase.rpc('add_clinic', {
        p_doctor_id: user.id,
        p_name:      newClinic.name,
        p_address:   newClinic.address,
        p_phone:     newClinic.phone,
        p_google_maps_link: newClinic.googleMapsLink || null,
      });
      if (error) throw error;
      toast.success('تمت إضافة العيادة ✓');
      setShowClinicForm(false);
      setNewClinic({ name: '', address: '', phone: '', googleMapsLink: '' });
      fetchClinics();
    } catch (e: any) { toast.error('فشل إضافة العيادة: ' + e.message); }
  };

  const handleDeleteClinic = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.rpc('delete_clinic', {
        p_clinic_id: id,
        p_doctor_id: user.id,
      });
      if (error) throw error;
      toast.success('تم حذف العيادة');
      fetchClinics();
    } catch (e: any) { toast.error('فشل الحذف: ' + e.message); }
  };

  const handleSave = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // SECURITY DEFINER RPC — avoids .select().single() RLS failure for anon doctors
      const { data, error } = await supabase.rpc('update_doctor_profile', {
        p_doctor_id:      user.id,
        p_name:           profile.name,
        p_email:          profile.email || null,
        p_phone:          profile.phone || null,
        p_specialization: profile.specialization || null,
        p_price:          profile.price ? Number(profile.price) : null,
        p_bio:            profile.bio || null,
        p_governorate:    profile.governorate || null,
      });

      if (error) throw error;

      // RPC returns SETOF (array), grab first row
      const updated = Array.isArray(data) ? data[0] : data;
      if (updated) setAuth(updated);

      toast.success('تم حفظ الملف الشخصي ✓');
    } catch (err: any) {
      if (err.message?.includes('users_email_key')) {
        toast.error('البريد الإلكتروني مستخدم من قِبل حساب آخر');
      } else {
        toast.error('فشل الحفظ: ' + (err.message || 'خطأ غير متوقع'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
        >
          <Save className="w-4 h-4" />
          {isLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">الملف الشخصي</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">إعداداتك المهنية وبياناتك الطبية</p>
        </div>
      </div>

      {/* Profile Card — full-bleed cover header */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="h-28 relative" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #4f46e5 60%, #7c3aed 100%)' }}>
          <div className="absolute inset-0 opacity-[0.05]"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
        </div>
        <div className="px-8 pb-8 flex items-end gap-6 -mt-12 text-right">
          <div className="relative group flex-1 pb-2">
            <h2 className="text-2xl font-black text-slate-900">{user?.name || 'د. اسم الطبيب'}</h2>
            <p className="text-slate-500 font-medium">{(user as any)?.specialization || 'التخصص'}</p>
          </div>
          <div className="relative flex-shrink-0">
            <Avatar className="w-28 h-28 border-4 border-white shadow-2xl">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback
                className="text-white text-4xl font-black"
                style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
              >
                {user?.name?.charAt(0) || 'د'}
              </AvatarFallback>
            </Avatar>
            <button className="absolute bottom-1 right-1 w-9 h-9 bg-white rounded-2xl shadow-lg flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors border border-slate-100">
              <Camera className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Two column form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Personal Info */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 text-right">
          <div>
            <h2 className="font-black text-slate-900">المعلومات الشخصية</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">بياناتك الأساسية</p>
          </div>
          <FIELD label="الاسم الكامل" icon={User} value={profile.name} onChange={(e: any) => setProfile({ ...profile, name: e.target.value })} />
          <FIELD label="البريد الإلكتروني" icon={Mail} type="email" dir="ltr" value={profile.email} onChange={(e: any) => setProfile({ ...profile, email: e.target.value })} />
          <FIELD label="رقم الهاتف" icon={Phone} type="tel" dir="ltr" value={profile.phone} onChange={(e: any) => setProfile({ ...profile, phone: e.target.value })} />
          
          <div className="space-y-1.5 text-right">
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">المحافظة في العراق</label>
            <select
              value={profile.governorate}
              onChange={e => setProfile({ ...profile, governorate: e.target.value })}
              className="w-full h-13 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-right"
            >
              <option value="">اختر المحافظة...</option>
              {IRAQI_GOVERNORATES.map(gov => (
                <option key={gov} value={gov}>{gov}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Professional Info */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4 text-right">
          <div>
            <h2 className="font-black text-slate-900">التفاصيل المهنية</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">تخصصك ورسوم الكشفية</p>
          </div>
          <FIELD label="التخصص الطبي" icon={Award} value={profile.specialization} placeholder="مثلاً: أمراض القلب" onChange={(e: any) => setProfile({ ...profile, specialization: e.target.value })} />
          <FIELD label="رسوم الكشفية (د.ع)" icon={DollarSign} type="number" dir="ltr" value={profile.price} onChange={(e: any) => setProfile({ ...profile, price: e.target.value })} />
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">السيرة المهنية</label>
            <textarea
              value={profile.bio}
              onChange={e => setProfile({ ...profile, bio: e.target.value })}
              placeholder="اكتب نبذة مختصرة عن خبرتك..."
              className="w-full p-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all min-h-[100px] resize-none text-right"
            />
          </div>
        </div>

        {/* Clinics full-width */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-5 text-right">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowClinicForm(!showClinicForm)}
              className="flex items-center gap-2 text-sm font-bold border-2 border-slate-100 hover:border-indigo-200 hover:text-indigo-600 px-4 py-2 rounded-2xl transition-all"
            >
              <Plus className="w-4 h-4" />
              إضافة عيادة
            </button>
            <div>
              <h2 className="font-black text-slate-900">إدارة العيادات</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">{clinics.length} عيادة مسجلة</p>
            </div>
          </div>

          {showClinicForm && (
            <div className="border-2 border-indigo-100 bg-indigo-50/30 rounded-2xl p-5 space-y-4">
              <h3 className="font-black text-slate-800 text-sm">بيانات العيادة الجديدة</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input placeholder="اسم العيادة *" value={newClinic.name} onChange={e => setNewClinic({ ...newClinic, name: e.target.value })}
                  className="h-11 px-4 rounded-xl border-2 border-slate-100 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:border-indigo-400 transition-all" />
                <input placeholder="العنوان" value={newClinic.address} onChange={e => setNewClinic({ ...newClinic, address: e.target.value })}
                  className="h-11 px-4 rounded-xl border-2 border-slate-100 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:border-indigo-400 transition-all" />
                <input placeholder="+964..." dir="ltr" value={newClinic.phone} onChange={e => setNewClinic({ ...newClinic, phone: e.target.value })}
                  className="h-11 px-4 rounded-xl border-2 border-slate-100 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:border-indigo-400 transition-all" />
              </div>
              <div className="flex gap-3 items-end">
                <div className="flex-1 text-right">
                  <span className="text-xs text-slate-400 font-bold block mb-1">رابط خرائط جوجل (Google Maps Link)</span>
                  <input placeholder="إلصق رابط مشاركة الموقع أو حدده من الخريطة" value={newClinic.googleMapsLink} onChange={e => setNewClinic({ ...newClinic, googleMapsLink: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border-2 border-slate-100 bg-white text-slate-800 text-sm font-medium focus:outline-none focus:border-indigo-400 transition-all text-right" />
                </div>
                <button type="button" onClick={() => setMapOpen(true)} className="h-11 px-4 rounded-xl border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-sm flex items-center gap-1.5 transition-all">
                  <MapPin className="w-4 h-4" />
                  تحديد من الخريطة
                </button>
              </div>
              <div className="flex gap-2 justify-start">
                <button onClick={() => setShowClinicForm(false)} className="px-4 py-2 rounded-xl border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-50">إلغاء</button>
                <button onClick={handleAddClinic} className="px-5 py-2 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>إضافة</button>
              </div>
            </div>
          )}

          {clinics.length === 0 && !showClinicForm ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                <MapPin className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-400 font-bold text-sm">لم تضف أي عيادات بعد</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {clinics.map((clinic) => (
                <div
                  key={clinic.id}
                  className="group flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all"
                >
                  <button
                    onClick={() => handleDeleteClinic(clinic.id)}
                    className="w-8 h-8 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1 text-right min-w-0">
                    <p className="font-black text-slate-800 text-sm truncate">{clinic.name}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">{clinic.address}</p>
                    {clinic.phone && <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{clinic.phone}</p>}
                    {clinic.google_maps_link && (
                      <a href={clinic.google_maps_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5">
                        <MapPin className="w-3 h-3" />
                        رابط الخريطة
                      </a>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)' }}>
                    <MapPin className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
