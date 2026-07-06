import { useState, useMemo, useEffect } from 'react';
import { Search, Star, MapPin, SlidersHorizontal, X, Loader2, ChevronDown } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SPECIALTIES } from '@/lib/mock-data';
import { DoctorAvatar } from '@/components/DoctorAvatar';
import { useAuthStore } from '@/store/useAuthStore';

export default function DoctorsListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [specialtyFilter, setSpecialtyFilter] = useState(searchParams.get('specialty') || 'all');
  const [priceRange, setPriceRange] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [complexes, setComplexes] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoadingData(true);
      try {
        // Fetch complexes
        try {
          const { data: compData } = await supabase.rpc('get_medical_complexes');
          let complexesList = compData || [];
          if (user?.governorate) {
            complexesList = complexesList.filter((c: any) => c.governorate === user.governorate);
          }
          setComplexes(complexesList);
        } catch (e) {
          console.error(e);
        }

        let specData: any[] | null = null;
        try {
          const { data } = await supabase.from('specialties').select('*');
          specData = data;
        } catch (e) {}
        setSpecialties(specData && specData.length > 0 ? specData : SPECIALTIES);

        let docData: any[] | null = null;
        try {
          const { data } = await supabase.from('users').select('*');
          docData = data;
        } catch (e) {}

        if (docData && docData.length > 0) {
          let docs = docData.filter(d => (d.role === 'DOCTOR' || d.role === 'doctor') && d.status === 'active');
          if (user?.governorate) {
            const govDocs = docs.filter(d => d.governorate === user.governorate);
            if (govDocs.length > 0) {
              docs = govDocs;
            }
          }
          const formatted = docs.map(d => {
            let spec = d.specialization;
            if (!spec && d.bio?.includes('التخصص:')) {
              spec = d.bio.split('\n').find((l: string) => l.includes('التخصص:'))?.replace('التخصص:', '').split('[')[0].trim();
            }
            return {
              ...d,
              specialization: spec || 'غير محدد',
              image: d.avatar_url || `https://picsum.photos/seed/${d.id}/400/400`,
              rating: 4.8,
              reviews: 124,
              availableTimes: ['09:00 ص', '11:00 ص', '02:30 م'],
              locations: [d.address || 'بغداد'],
              price: d.price || 150000,
            };
          });
          setDoctors(formatted);
        } else {
          setDoctors([]);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchData();
  }, [user]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter(doctor => {
      const matchesSearch =
        doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doctor.specialization.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSpecialty = specialtyFilter === 'all' || doctor.specialization === specialtyFilter;

      let matchesPrice = true;
      if (priceRange === 'low') matchesPrice = doctor.price < 120000;
      if (priceRange === 'mid') matchesPrice = doctor.price >= 120000 && doctor.price <= 150000;
      if (priceRange === 'high') matchesPrice = doctor.price > 150000;

      const matchesLocation = locationFilter === 'all' ||
        (doctor.locations && doctor.locations.some((l: string) => l.includes(locationFilter)));

      return matchesSearch && matchesSpecialty && matchesPrice && matchesLocation;
    });
  }, [doctors, searchQuery, specialtyFilter, priceRange, locationFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setSpecialtyFilter('all');
    setPriceRange('all');
    setLocationFilter('all');
  };

  const hasFilters = searchQuery || specialtyFilter !== 'all' || priceRange !== 'all' || locationFilter !== 'all';

  return (
    <div className="space-y-5 pb-6">
      {/* Search + Filter header */}
      <div className="space-y-3">
        <div className="flex gap-3">
          {/* Search bar */}
          <div className="flex-1 relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث عن طبيب أو تخصص..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-13 pr-12 pl-5 py-3.5 rounded-2xl bg-white border-2 border-slate-100 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 transition-all"
            />
          </div>
          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm border-2 transition-all ${showFilters ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-600 hover:border-indigo-200'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            فلاتر
            {hasFilters && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
          </button>
        </div>

        {/* Expandable Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Specialty */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block text-right">التخصص</label>
                <div className="relative">
                  <select
                    value={specialtyFilter}
                    onChange={(e) => setSpecialtyFilter(e.target.value)}
                    className="w-full h-11 pr-4 pl-8 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-700 font-bold text-sm focus:outline-none focus:border-indigo-400 appearance-none"
                  >
                    <option value="all">جميع التخصصات</option>
                    {specialties.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Price Range */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block text-right">نطاق السعر</label>
                <div className="flex gap-2">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'low', label: '-120K' },
                    { id: 'mid', label: '~150K' },
                    { id: 'high', label: '+150K' },
                  ].map(r => (
                    <button
                      key={r.id}
                      onClick={() => setPriceRange(r.id)}
                      className={`flex-1 py-2 rounded-xl text-xs font-black border-2 transition-all ${priceRange === r.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block text-right">المنطقة</label>
                <div className="relative">
                  <select
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="w-full h-11 pr-4 pl-8 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-700 font-bold text-sm focus:outline-none focus:border-indigo-400 appearance-none"
                  >
                    <option value="all">جميع المناطق</option>
                    <option value="بغداد">بغداد</option>
                    <option value="البصرة">البصرة</option>
                    <option value="أربيل">أربيل</option>
                    <option value="المنصور">المنصور</option>
                    <option value="الحارثية">الحارثية</option>
                  </select>
                  <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {hasFilters && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 text-xs font-black text-red-500 hover:text-red-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  مسح الفلاتر
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-sm font-bold text-slate-500">
          {filteredDoctors.length} طبيب متاح
        </p>
        <select className="text-sm font-bold text-indigo-600 bg-transparent border-none focus:outline-none cursor-pointer">
          <option>الأعلى تقييماً</option>
          <option>الأقل سعراً</option>
          <option>الأعلى سعراً</option>
        </select>
      </div>

      {/* Doctors List */}
      {isLoadingData ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">جاري تحميل الأطباء...</p>
        </div>
      ) : filteredDoctors.length > 0 ? (
        <div className="space-y-4">
          {filteredDoctors.map((doctor) => (
            <div
              key={doctor.id}
              className="group bg-white rounded-3xl border border-slate-100 overflow-hidden hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all duration-300 cursor-pointer"
              onClick={() => navigate(`/doctors/${doctor.id}`)}
            >
              <div className="flex flex-col md:flex-row">
                {/* Image */}
                <div className="md:w-56 h-48 md:h-auto relative overflow-hidden bg-slate-100 flex-shrink-0">
                  <DoctorAvatar
                    name={doctor.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 rounded-xl px-2 py-1 shadow-sm">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-black text-slate-800">{doctor.rating}</span>
                    <span className="text-[10px] text-slate-400">({doctor.reviews})</span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 flex flex-col justify-between text-right">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black text-slate-900">{doctor.name}</h3>
                        <div className="flex flex-wrap gap-1.5 mt-1.5 justify-end">
                          <span className="inline-block text-xs font-black text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1">
                            {doctor.specialization}
                          </span>
                          {(() => {
                            const comp = complexes.find(c => c.id === doctor.complex_id);
                            if (comp) {
                              return (
                                <span className="inline-block text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-xl px-2.5 py-1">
                                  مجمع: {comp.name}
                                </span>
                              );
                            } else {
                              return (
                                <span className="inline-block text-[10px] font-black text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1">
                                  عيادة مستقلة
                                </span>
                              );
                            }
                          })()}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-left">
                        <span className="text-xs text-slate-400 font-bold block">الكشفية</span>
                        <p className="text-xl font-black text-indigo-600">{doctor.price.toLocaleString()}<span className="text-xs text-slate-400 font-bold"> د.ع</span></p>
                      </div>
                    </div>

                    <p className="text-slate-500 text-sm font-medium leading-relaxed line-clamp-2">
                      {doctor.about}
                    </p>

                    <div className="flex items-center gap-1.5 text-sm text-slate-500 font-medium">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>{doctor.locations?.[0] || 'بغداد'}</span>
                    </div>

                    {/* Available times */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400 font-bold">متاح:</span>
                      {doctor.availableTimes?.slice(0, 3).map((t: string, i: number) => (
                        <span key={i} className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-50 flex items-center justify-between gap-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/doctors/${doctor.id}`); }}
                      className="flex-1 md:flex-none md:px-8 py-2.5 rounded-2xl text-sm font-black text-white transition-all hover:opacity-90 active:scale-[0.98] shadow-md shadow-indigo-100"
                      style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                    >
                      احجز موعداً الآن
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/doctors/${doctor.id}`); }}
                      className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors border border-slate-100 hover:border-indigo-200 px-4 py-2.5 rounded-2xl"
                    >
                      عرض الملف
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-5">
            <Search className="w-9 h-9 text-slate-300" />
          </div>
          <h3 className="text-lg font-black text-slate-700 mb-2">لا توجد نتائج</h3>
          <p className="text-slate-400 font-medium text-sm mb-6 max-w-xs">
            لم نجد أطباء يطابقون بحثك. جرّب تغيير الفلاتر أو مسحها.
          </p>
          <button
            onClick={clearFilters}
            className="px-8 py-3 rounded-2xl font-black text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
          >
            مسح كل الفلاتر
          </button>
        </div>
      )}
    </div>
  );
}
