import { useState, useEffect } from 'react';
import { Search, HeartPulse, Baby, Brain, Activity, Eye, Stethoscope, Smile, UserCircle, Star, MapPin, ArrowLeft, Calendar, FileText, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { SPECIALTIES } from '@/lib/mock-data';
import { DoctorAvatar } from '@/components/DoctorAvatar';

const iconMap: Record<string, any> = {
  HeartPulse, UserCircle, Baby, Brain, Activity, Eye, Stethoscope, Smile
};

const SPECIALTY_COLORS = [
  { bg: 'bg-rose-50', icon: 'text-rose-500', border: 'hover:border-rose-200' },
  { bg: 'bg-sky-50', icon: 'text-sky-500', border: 'hover:border-sky-200' },
  { bg: 'bg-emerald-50', icon: 'text-emerald-500', border: 'hover:border-emerald-200' },
  { bg: 'bg-violet-50', icon: 'text-violet-500', border: 'hover:border-violet-200' },
  { bg: 'bg-amber-50', icon: 'text-amber-500', border: 'hover:border-amber-200' },
  { bg: 'bg-indigo-50', icon: 'text-indigo-500', border: 'hover:border-indigo-200' },
  { bg: 'bg-pink-50', icon: 'text-pink-500', border: 'hover:border-pink-200' },
  { bg: 'bg-teal-50', icon: 'text-teal-500', border: 'hover:border-teal-200' },
];

const QUICK_ACTIONS = [
  { icon: Search, label: 'ابحث عن طبيب', href: '/doctors', color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-200' },
  { icon: Calendar, label: 'حجوزاتي', href: '/bookings', color: 'from-violet-500 to-purple-600', shadow: 'shadow-violet-200' },
  { icon: FileText, label: 'سجلاتي', href: '/medical-records', color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-200' },
  { icon: Wallet, label: 'المحفظة', href: '/wallet', color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-200' },
];

export default function PatientHomePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [user]);

  const fetchData = async () => {
    try {
      let specData: any[] | null = null;
      try {
        const { data } = await supabase.from('specialties').select('*').limit(8);
        specData = data;
      } catch (e) {}
      setSpecialties(specData && specData.length > 0 ? specData : SPECIALTIES);

      let docData: any[] | null = null;
      try {
        const { data } = await supabase.from('users').select('*');
        docData = data;
      } catch (e) {}

      if (docData && docData.length > 0) {
        let docs = docData.filter(u => (u.role === 'DOCTOR' || u.role === 'doctor') && u.status === 'active');
        if (user?.governorate) {
          const govDocs = docs.filter(u => u.governorate === user.governorate);
          if (govDocs.length > 0) {
            docs = govDocs;
          }
        }
        const formatted = docs.slice(0, 3).map(d => ({
          ...d,
          specialization: d.specialization || 'طبيب',
          image: d.avatar_url || `https://picsum.photos/seed/${d.id}/400/400`,
          rating: 4.8,
        }));
        setDoctors(formatted);
      } else {
        setDoctors([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'صباح الخير';
    if (h < 17) return 'مساء الخير';
    return 'مساء النور';
  };

  return (
    <div className="space-y-8 pb-6">

      {/* ── HERO BANNER ── */}
      <div
        className="relative rounded-3xl overflow-hidden text-white p-8 md:p-10"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 40%, #4f46e5 80%, #6d28d9 100%)' }}
      >
        {/* Background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }} />
          <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        <div className="relative z-10 space-y-6">
          {/* Greeting row */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/70 text-sm font-bold">{greeting()} ،</p>
              <h1 className="text-2xl md:text-3xl font-black leading-snug mt-0.5">
                {user?.name || 'زائرنا الكريم'}
              </h1>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white/20 border-2 border-white/30 shadow-xl flex items-center justify-center font-black text-white text-lg select-none">
              {user?.name?.charAt(0) || 'م'}
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-lg">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
            <input
              type="text"
              placeholder="ابحث عن أطباء، تخصصات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && navigate(`/doctors?search=${searchQuery}`)}
              className="w-full h-13 pr-12 pl-5 py-3.5 rounded-2xl bg-white text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-lg transition-all"
            />
          </div>
        </div>
      </div>

      {/* ── QUICK ACCESS BENTO GRID ── */}
      <section className="space-y-3">
        <h2 className="text-lg font-black text-slate-800 pr-1">الوصول السريع</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.href)}
              className={`group flex flex-col items-center gap-3 p-5 rounded-3xl bg-white border border-slate-100 hover:border-transparent hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 ${action.shadow} hover:shadow-opacity-40 text-center`}
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${action.color} flex items-center justify-center shadow-md shadow-opacity-30 ${action.shadow} group-hover:scale-110 transition-transform duration-200`}>
                <action.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-bold text-slate-700 group-hover:text-slate-900 transition-colors">{action.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── SPECIALTIES ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pr-1">
          <h2 className="text-lg font-black text-slate-800">التخصصات الطبية</h2>
          <button
            onClick={() => navigate('/doctors')}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
          >
            عرض الكل
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </button>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {specialties.map((spec, i) => {
            const Icon = iconMap[spec.icon] || Stethoscope;
            const colors = SPECIALTY_COLORS[i % SPECIALTY_COLORS.length];
            return (
              <button
                key={spec.id}
                onClick={() => navigate(`/doctors?specialty=${spec.name}`)}
                className={`group flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border-2 border-transparent ${colors.border} hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
              >
                <div className={`w-10 h-10 rounded-xl ${colors.bg} ${colors.icon} flex items-center justify-center group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black text-slate-600 text-center leading-tight">{spec.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── FEATURED DOCTORS ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pr-1">
          <h2 className="text-lg font-black text-slate-800">أطباء متميزون</h2>
          <button
            onClick={() => navigate('/doctors')}
            className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
          >
            عرض الكل
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {doctors.map((doctor) => (
            <div
              key={doctor.id}
              className="group bg-white rounded-3xl overflow-hidden border border-slate-100 hover:border-transparent hover:shadow-2xl hover:shadow-indigo-100 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
              onClick={() => navigate(`/doctors/${doctor.id}`)}
            >
              {/* Doctor image */}
              <div className="relative h-52 overflow-hidden bg-slate-100">
                <DoctorAvatar
                  name={doctor.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                {/* Rating badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-1.5 shadow-sm">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-xs font-black text-slate-800">{doctor.rating}</span>
                </div>
                {/* Specialty badge */}
                <div className="absolute bottom-3 left-3 bg-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-md">
                  {doctor.specialization}
                </div>
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="text-right flex-1 min-w-0">
                    <h3 className="font-black text-slate-900 text-base truncate">{doctor.name}</h3>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <span className="text-sm text-slate-500 font-medium truncate">{doctor.address || (doctor.locations && doctor.locations[0]) || 'بغداد'}</span>
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <span className="text-xs text-slate-400 font-bold block">كشفية</span>
                    <span className="text-base font-black text-indigo-600">{(doctor.price || 150000).toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-bold"> د.ع</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/doctors/${doctor.id}`); }}
                  className="w-full py-2.5 rounded-2xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                >
                  احجز موعداً
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
