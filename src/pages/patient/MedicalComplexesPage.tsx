import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Building2, MapPin, Phone, Globe, ArrowLeft, Loader2, Star, User, ChevronLeft, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { toast } from 'sonner';
import { useAuthStore } from '@/store/useAuthStore';

export default function MedicalComplexesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [complexes, setComplexes] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedComplex, setSelectedComplex] = useState<any | null>(null);
  
  // Map modal/preview coordinates
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch complexes
      const { data: complexesData, error: compErr } = await supabase.rpc('get_medical_complexes');
      if (compErr) throw compErr;

      // Fetch doctors
      const { data: usersData, error: userErr } = await supabase.from('users').select('*');
      if (userErr) throw userErr;

      let filteredComplexes = complexesData || [];
      let filteredUsers = usersData || [];

      if (user?.governorate) {
        filteredComplexes = filteredComplexes.filter((c: any) => c.governorate === user.governorate);
        filteredUsers = filteredUsers.filter((u: any) => u.governorate === user.governorate);
      }

      const docs = filteredUsers
        .filter((u: any) => u.role === 'DOCTOR' && u.status === 'active')
        .map((u: any) => {
          let spec = u.specialization;
          if (!spec && u.bio?.includes('التخصص:')) {
            spec = u.bio.split('\n').find((l: string) => l.includes('التخصص:'))?.replace('التخصص:', '').split('[')[0].trim();
          }
          return {
            ...u,
            specialization: spec || 'غير محدد'
          };
        });

      setComplexes(filteredComplexes);
      setDoctors(docs);
    } catch (e) {
      console.error(e);
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedComplex) return;

    // Load leaflet stylesheet & script dynamically if needed
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
  }, [selectedComplex]);

  const initMap = () => {
    setTimeout(() => {
      const L = (window as any).L;
      if (!L || !selectedComplex) return;

      const coords = parseCoordinates(selectedComplex.google_maps_link);
      const defaultLat = coords ? coords.lat : 33.3152;
      const defaultLng = coords ? coords.lng : 44.3661;

      const container = L.DomUtil.get('map-complex-view-container');
      if (container) {
        (container as any)._leaflet_id = null;
      }

      const map = L.map('map-complex-view-container').setView([defaultLat, defaultLng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      L.marker([defaultLat, defaultLng]).addTo(map)
        .bindPopup(selectedComplex.name)
        .openPopup();
    }, 150);
  };

  const parseCoordinates = (link: string) => {
    if (!link) return null;
    const match = link.match(/query=([-\d.]+),([-\d.]+)/);
    if (match) {
      return {
        lat: parseFloat(match[1]),
        lng: parseFloat(match[2])
      };
    }
    return null;
  };

  const filteredComplexes = complexes.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getComplexDoctors = (complexId: string) => {
    return doctors.filter(d => d.complex_id === complexId);
  };

  return (
    <div className="space-y-6 pb-12 text-right" dir="rtl">
      {/* Hero Header Banner */}
      <div className="bg-gradient-to-l from-indigo-900 to-indigo-700 rounded-[32px] p-8 text-white relative overflow-hidden shadow-lg">
        {/* Decorative background grid */}
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
        
        <div className="relative z-10 space-y-2 max-w-xl">
          <span className="bg-white/20 text-white text-[10px] font-black uppercase px-3 py-1 rounded-full tracking-wider inline-block">
            دليل المراكز الطبية
          </span>
          <h1 className="text-3xl font-black">المجمعات الطبية</h1>
          <p className="text-indigo-100/90 text-sm font-medium leading-relaxed">
            تصفح أفضل المجمعات والمراكز الطبية التخصصية، واكتشف النخبة من الأطباء والاستشاريين العاملين بها مع تحديد مواقعها بدقة على الخريطة.
          </p>
        </div>
      </div>

      {/* Search Header */}
      <div className="flex gap-4 items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث باسم المجمع أو العنوان..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pr-12 pl-4 rounded-2xl border-2 border-slate-100 bg-white text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 transition-all text-right"
          />
        </div>
      </div>

      {/* Main Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-3">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
          <p className="text-slate-500 font-bold text-sm">جاري تحميل المجمعات الطبية...</p>
        </div>
      ) : filteredComplexes.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-100 p-16 text-center text-slate-400 font-bold shadow-sm">
          <Building2 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
          <p className="text-lg">لا توجد مجمعات طبية مطابقة للبحث</p>
          <p className="text-xs font-normal text-slate-400 mt-1">تأكد من كتابة الاسم بشكل صحيح أو جرب كلمات بحث أخرى</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredComplexes.map((complex) => {
            const compDocs = getComplexDoctors(complex.id);
            return (
              <div
                key={complex.id}
                className="bg-white rounded-[28px] border-2 border-slate-100/80 p-6 flex flex-col justify-between hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50/50 transition-all duration-300 group"
              >
                <div className="space-y-4">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-1.5 rounded-xl">
                      {compDocs.length} أطباء
                    </span>
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                      <Building2 className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Title and date */}
                  <div className="space-y-1">
                    <h3 className="font-black text-slate-800 text-lg group-hover:text-indigo-600 transition-colors">
                      {complex.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold">مجمع طبي معتمد</p>
                  </div>

                  {/* Info list */}
                  <div className="space-y-2.5 text-xs text-slate-600 pt-2">
                    {complex.address && (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-bold text-slate-500">{complex.address}</span>
                        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </div>
                    )}
                    {complex.phone && (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="font-mono font-bold text-slate-500" dir="ltr">{complex.phone}</span>
                        <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-5 mt-5 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedComplex(complex)}
                    className="w-full h-11 rounded-2xl bg-slate-50 hover:bg-indigo-600 hover:text-white border border-slate-100 text-indigo-600 font-black text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    عرض التفاصيل والأطباء
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Details Side Drawer / Modal Overlay */}
      {selectedComplex && (
        <div 
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setSelectedComplex(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed top-0 right-0 bottom-0 w-full max-w-4xl h-full bg-slate-50 shadow-2xl flex flex-col animate-slide-in-right text-right overflow-hidden border-l border-slate-200"
            dir="rtl"
          >
            {/* Close button float */}
            <button
              onClick={() => setSelectedComplex(null)}
              className="absolute left-6 top-6 z-50 w-11 h-11 rounded-2xl bg-white border border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-slate-700 flex items-center justify-center transition-colors shadow-sm"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header info */}
            <div className="bg-white p-6 pt-10 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2 mt-4 md:mt-0 flex-1">
                <div className="flex items-center gap-2.5 justify-start">
                  <span className="bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-black px-2.5 py-1 rounded-lg">مجمع طبي</span>
                  <h2 className="text-2xl font-black text-slate-900">{selectedComplex.name}</h2>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 justify-start text-xs text-slate-500 font-bold">
                  {selectedComplex.address && (
                    <span className="flex items-center gap-1">{selectedComplex.address} <MapPin className="w-3.5 h-3.5 text-slate-400" /></span>
                  )}
                  {selectedComplex.phone && (
                    <span className="flex items-center gap-1" dir="ltr">{selectedComplex.phone} <Phone className="w-3.5 h-3.5 text-slate-400" /></span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Doctors list section (3 cols) - placed first to appear on the right side of the split screen */}
              <div className="lg:col-span-3 space-y-4 order-1 lg:order-1">
                <h4 className="font-black text-slate-800 text-sm">الأطباء المتواجدون في المجمع ({getComplexDoctors(selectedComplex.id).length})</h4>
                
                <div className="space-y-3">
                  {getComplexDoctors(selectedComplex.id).length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center text-slate-400 font-bold">
                      <User className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      لا يوجد أطباء مضافون لهذا المجمع حالياً
                    </div>
                  ) : (
                    getComplexDoctors(selectedComplex.id).map(doc => (
                      <div
                        key={doc.id}
                        className="bg-white rounded-2xl border border-slate-100 p-4 flex gap-4 items-center justify-between hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Vector Avatar */}
                          <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-100">
                            <DoctorAvatar name={doc.name} className="w-full h-full" />
                          </div>
                          
                          <div className="min-w-0 text-right space-y-0.5">
                            <h5 className="font-black text-slate-800 text-sm truncate">{doc.name}</h5>
                            <p className="text-xs text-indigo-600 font-black">{doc.specialization}</p>
                            
                            <div className="flex items-center gap-1 justify-start pt-1">
                              <span className="text-[10px] text-slate-400 font-bold">(124 تقييم)</span>
                              <span className="text-xs text-amber-500 font-black">4.8</span>
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedComplex(null);
                            navigate(`/book/${doc.id}`);
                          }}
                          className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1 transition-all flex-shrink-0"
                        >
                          احجز الآن
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Map & Meta section (2 cols) - placed second to appear on the left side of the split screen */}
              <div className="lg:col-span-2 space-y-6 order-2 lg:order-2">
                <div className="bg-white rounded-[28px] border border-slate-100 p-5 shadow-sm space-y-4">
                  <h4 className="font-black text-slate-800 text-sm">موقع المجمع على الخريطة</h4>
                  <div
                    id="map-complex-view-container"
                    className="w-full h-[250px] rounded-2xl border border-slate-100 overflow-hidden shadow-inner bg-slate-100"
                  ></div>
                  {selectedComplex.google_maps_link && (
                    <a
                      href={selectedComplex.google_maps_link}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full h-11 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-indigo-100 transition-colors"
                    >
                      فتح في خرائط جوجل <Globe className="w-4 h-4" />
                    </a>
                  )}
                </div>

                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-[28px] p-6 space-y-4 shadow-sm relative overflow-hidden">
                  <div className="absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
                  <div className="relative z-10 space-y-2">
                    <h4 className="font-black text-sm">الرعاية والخدمات الطبية</h4>
                    <p className="text-xs text-indigo-200 leading-relaxed font-medium">
                      جميع الأطباء في هذا المجمع تم التحقق من شهاداتهم المهنية وتراخيصهم الصحية لضمان أعلى معايير الجودة والسلامة.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
