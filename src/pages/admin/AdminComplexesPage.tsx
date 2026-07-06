import React, { useState, useEffect } from 'react';
import { Search, Building2, Plus, Edit2, Trash2, Loader2, MapPin, Phone, Globe, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { IRAQI_GOVERNORATES } from '@/lib/constants';

const FORM_FIELD = ({ label, value, onChange, type = 'text', dir = 'rtl', placeholder = '' }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">{label}</label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} dir={dir}
      className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
  </div>
);

const EMPTY_FORM = { name: '', address: '', phone: '', googleMapsLink: '', governorate: '' };

export default function AdminComplexesPage() {
  const [complexes, setComplexes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [panel, setPanel] = useState<'none' | 'add' | 'edit'>('none');
  const [selectedComplex, setSelectedComplex] = useState<any | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Map picker modal states
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    fetchComplexes();
  }, []);

  useEffect(() => {
    if (!mapOpen) return;

    if ((window as any).L) {
      initMap();
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
      initMap();
    };
    document.head.appendChild(script);
  }, [mapOpen]);

  const initMap = () => {
    setTimeout(() => {
      const L = (window as any).L;
      if (!L) return;

      let defaultLat = 33.3152;
      let defaultLng = 44.3661;

      // Try to parse existing link coordinates
      if (form.googleMapsLink) {
        const match = form.googleMapsLink.match(/query=([-\d.]+),([-\d.]+)/);
        if (match) {
          defaultLat = parseFloat(match[1]);
          defaultLng = parseFloat(match[2]);
        }
      }

      const container = L.DomUtil.get('map-complex-picker-container');
      if (container) {
        (container as any)._leaflet_id = null;
      }

      const map = L.map('map-complex-picker-container').setView([defaultLat, defaultLng], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      let marker = L.marker([defaultLat, defaultLng], { draggable: true }).addTo(map);

      const updateCoordinates = (lat: number, lng: number) => {
        const link = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        setForm(f => ({ ...f, googleMapsLink: link }));
      };

      // Set initial
      updateCoordinates(defaultLat, defaultLng);

      marker.on('dragend', function (event: any) {
        const position = marker.getLatLng();
        updateCoordinates(position.lat, position.lng);
      });

      map.on('click', function (e: any) {
        marker.setLatLng(e.latlng);
        updateCoordinates(e.latlng.lat, e.latlng.lng);
      });
    }, 150);
  };

  const fetchComplexes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_medical_complexes');
      if (error) throw error;
      setComplexes(data || []);
    } catch (e) {
      console.error(e);
      toast.error('فشل تحميل المجمعات الطبية');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setPanel('add');
  };

  const openEdit = (complex: any) => {
    setSelectedComplex(complex);
    setForm({
      name: complex.name || '',
      address: complex.address || '',
      phone: complex.phone || '',
      googleMapsLink: complex.google_maps_link || '',
      governorate: complex.governorate || ''
    });
    setPanel('edit');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('يرجى كتابة اسم المجمع الطبي');
      return;
    }
    setSaving(true);
    try {
      if (panel === 'add') {
        const { error } = await supabase.rpc('add_medical_complex', {
          p_name: form.name,
          p_address: form.address,
          p_phone: form.phone,
          p_google_maps_link: form.googleMapsLink,
          p_governorate: form.governorate || null
        });
        if (error) throw error;
        toast.success('تمت إضافة المجمع الطبي بنجاح ✓');
      } else if (panel === 'edit' && selectedComplex) {
        const { error } = await supabase.rpc('update_medical_complex', {
          p_id: selectedComplex.id,
          p_name: form.name,
          p_address: form.address,
          p_phone: form.phone,
          p_google_maps_link: form.googleMapsLink,
          p_governorate: form.governorate || null
        });
        if (error) throw error;
        toast.success('تم تحديث بيانات المجمع بنجاح ✓');
      }
      setPanel('none');
      setForm(EMPTY_FORM);
      fetchComplexes();
    } catch (err: any) {
      console.error(err);
      toast.error('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المجمع الطبي؟ (الأطباء المنتمون إليه سيتحولون لعيادات مستقلة)')) return;
    try {
      const { error } = await supabase.rpc('delete_medical_complex', { p_id: id });
      if (error) throw error;
      toast.success('تم حذف المجمع الطبي بنجاح');
      fetchComplexes();
    } catch (e) {
      console.error(e);
      toast.error('فشل حذف المجمع الطبي');
    }
  };

  const filtered = complexes.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-6 text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={openAdd}
          className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl hover:opacity-90 transition-all shadow-md"
          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
          <Plus className="w-4 h-4" />
          إضافة مجمع طبي جديد
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900">المجمعات الطبية</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">{complexes.length} مجمع طبي مسجل في النظام</p>
        </div>
      </div>

      {/* Add / Edit Form Panel */}
      {panel !== 'none' && (
        <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-sm p-6 space-y-4">
          <h2 className="font-black text-slate-900 text-lg">
            {panel === 'add' ? 'إضافة مجمع طبي جديد' : 'تعديل بيانات المجمع الطبي'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <FORM_FIELD label="اسم المجمع الطبي *" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً: مجمع الرافدين الطبي" />
            <FORM_FIELD label="العنوان الكامل" value={form.address} onChange={(e: any) => setForm({ ...form, address: e.target.value })} placeholder="بغداد، الكرادة" />
            <FORM_FIELD label="رقم الهاتف للتواصل" value={form.phone} dir="ltr" onChange={(e: any) => setForm({ ...form, phone: e.target.value })} placeholder="+964 7XX XXX XXXX" />
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">المحافظة</label>
              <select
                value={form.governorate || ''}
                onChange={(e: any) => setForm({ ...form, governorate: e.target.value })}
                className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-right"
              >
                <option value="">اختر المحافظة...</option>
                {IRAQI_GOVERNORATES.map((gov) => (
                  <option key={gov} value={gov}>{gov}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 items-end">
            <div className="flex-1 text-right">
              <span className="text-xs text-slate-500 font-black block mb-1.5">رابط خرائط جوجل (Google Maps Link)</span>
              <input
                placeholder="رابط الموقع على الخريطة"
                value={form.googleMapsLink}
                onChange={(e: any) => setForm({ ...form, googleMapsLink: e.target.value })}
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

          <div className="flex gap-3 justify-start pt-2">
            <button onClick={() => setPanel('none')} className="px-5 py-2.5 rounded-2xl border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all">إلغاء</button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 rounded-2xl font-bold text-sm text-white disabled:opacity-60 hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
              {saving ? 'جاري الحفظ...' : panel === 'add' ? 'إضافة المجمع' : 'حفظ التغييرات'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="البحث باسم المجمع أو العنوان..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-11 pr-11 pl-4 rounded-2xl border-2 border-slate-100 bg-white text-slate-800 font-medium placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-400 transition-all" />
        </div>
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">جاري تحميل المجمعات...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400 font-bold">
          <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          لا يوجد مجمعات طبية مطابقة للبحث
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((complex) => (
            <div key={complex.id} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4 relative flex flex-col justify-between hover:border-indigo-100 hover:shadow-md transition-all duration-200">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <h3 className="font-black text-slate-800 text-lg truncate">{complex.name}</h3>
                    <p className="text-xs text-slate-400 font-bold">تاريخ الإضافة: {new Date(complex.created_at).toLocaleDateString('ar-IQ')}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600 pt-1">
                  {complex.governorate && (
                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-bold text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-0.5">{complex.governorate}</span>
                      <MapPin className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                    </div>
                  )}
                  {complex.address && (
                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-medium text-xs">{complex.address}</span>
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </div>
                  )}
                  {complex.phone && (
                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-medium text-xs" dir="ltr">{complex.phone}</span>
                      <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    </div>
                  )}
                  {complex.google_maps_link && (
                    <div className="flex items-center gap-2 justify-end">
                      <a href={complex.google_maps_link} target="_blank" rel="noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 font-bold">
                        رابط خرائط جوجل <Globe className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 justify-start pt-3 border-t border-slate-50">
                <button onClick={() => openEdit(complex)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-xl transition-all">
                  <Edit2 className="w-3.5 h-3.5" />
                  تعديل
                </button>
                <button onClick={() => handleDelete(complex.id)} className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                  حذف
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Map Picker Modal */}
      {mapOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col text-right">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-800 text-lg">تحديد موقع المجمع الطبي</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">اسحب المؤشر (Marker) لتحديد الموقع الجغرافي بدقة</p>
              </div>
              <button onClick={() => setMapOpen(false)} className="w-10 h-10 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <div id="map-complex-picker-container" className="w-full h-[350px] rounded-2xl border border-slate-200 overflow-hidden shadow-inner bg-slate-100"></div>
              <div className="flex gap-3 justify-end mt-4">
                <button onClick={() => setMapOpen(false)}
                  className="px-6 py-2.5 rounded-2xl text-white font-bold text-sm hover:opacity-90 transition-all"
                  style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                  تأكيد الموقع وحفظ الإحداثيات
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
