import { useParams, useNavigate } from 'react-router-dom';
import { Star, MapPin, Clock, ShieldCheck, Calendar as CalendarIcon, ArrowRight, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { DOCTORS } from '@/lib/mock-data';
import { DoctorAvatar } from '@/components/DoctorAvatar';

const parseBioField = (bio: string, prefix: string, defaultValue: string) => {
  if (!bio) return defaultValue;
  const line = bio.split('\n').find(l => l.includes(prefix));
  if (line) {
    return line.replace(prefix, '').trim();
  }
  if (prefix === 'نبذة:') {
    const hasOtherPrefixes = ['التخصص:', 'الخبرة:', 'الترخيص:', 'المؤهلات:'].some(p => bio.includes(p));
    if (!hasOtherPrefixes) return bio;
  }
  return defaultValue;
};

export default function DoctorProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [totalSessionsCount, setTotalSessionsCount] = useState(0);
  const [weeklySessions, setWeeklySessions] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDoctor() {
      if (!id) return;
      setLoading(true);
      try {
        let docData: any = null;
        let clinicsData: any[] = [];

        try {
          const { data } = await supabase.from('users').select('*').eq('id', id).single();
          if (data) {
            docData = data;
            const { data: clinics } = await supabase.from('clinics').select('*').eq('doctor_id', id);
            clinicsData = clinics || [];
          }
        } catch (e) {}

        let complexName: string | null = null;
        if (docData && docData.complex_id) {
          try {
            const { data: complex } = await supabase.from('medical_complexes').select('name').eq('id', docData.complex_id).single();
            if (complex) {
              complexName = complex.name;
            }
          } catch (e) {}
        }

        if (docData) {
          let spec = docData.specialization;
          if (!spec && docData.bio?.startsWith('التخصص:')) {
            spec = docData.bio.replace('التخصص:', '').split('\n')[0].trim();
          }

          const bio = docData.bio || '';
          const qualifications = parseBioField(bio, 'المؤهلات:', 'بكالوريوس الطب، دبلوم تخصصي');
          const experience = parseBioField(bio, 'الخبرة:', '8+');
          const license = parseBioField(bio, 'الترخيص:', 'L-54124');
          const about = parseBioField(bio, 'نبذة:', bio || 'يقدم الطبيب رعاية صحية متميزة مع استخدام أحدث التقنيات العلاجية لتلبية احتياجات المرضى وضمان أعلى مستويات الأمان والجودة.');

          setDoctor({
            ...docData,
            specialization: spec || 'غير محدد',
            image: docData.avatar_url || `https://picsum.photos/seed/${docData.id}/600/400`,
            rating: 4.8,
            reviews: 124,
            clinics: clinicsData,
            complex_name: complexName,
            qualifications,
            experience,
            license,
            about,
          });

          // Fetch weekly sessions count (Sunday-Saturday)
          let weeklyBookingsCount = [0, 0, 0, 0, 0, 0, 0];
          try {
            const today = new Date();
            const currentDay = today.getDay(); // 0 = Sun
            const sunday = new Date(today);
            sunday.setDate(today.getDate() - currentDay);
            const saturday = new Date(sunday);
            saturday.setDate(sunday.getDate() + 6);

            const { data: bookings } = await supabase
              .from('bookings')
              .select('booking_date')
              .eq('doctor_id', id)
              .gte('booking_date', sunday.toISOString().split('T')[0])
              .lte('booking_date', saturday.toISOString().split('T')[0]);

            if (bookings) {
              bookings.forEach((b: any) => {
                try {
                  const d = new Date(b.booking_date);
                  const dayIndex = d.getDay();
                  if (dayIndex >= 0 && dayIndex < 7) {
                    weeklyBookingsCount[dayIndex]++;
                  }
                } catch (_) {}
              });
            }
          } catch (e) {
            console.error('Error fetching weekly bookings:', e);
          }

          setWeeklySessions([
            { day: 'الأحد',    short: 'أحد', sessions: weeklyBookingsCount[0] },
            { day: 'الاثنين',  short: 'إثن', sessions: weeklyBookingsCount[1] },
            { day: 'الثلاثاء', short: 'ثلا', sessions: weeklyBookingsCount[2] },
            { day: 'الأربعاء', short: 'أرب', sessions: weeklyBookingsCount[3] },
            { day: 'الخميس',  short: 'خمس', sessions: weeklyBookingsCount[4] },
            { day: 'الجمعة',  short: 'جمع', sessions: weeklyBookingsCount[5] },
            { day: 'السبت',   short: 'سبت', sessions: weeklyBookingsCount[6] },
          ]);

          // Fetch total completed sessions count
          try {
            const { count, error } = await supabase
              .from('bookings')
              .select('*', { count: 'exact', head: true })
              .eq('doctor_id', id);
            if (!error && count !== null) {
              setTotalSessionsCount(count);
            }
          } catch (e) {
            console.error(e);
          }
        } else {
          const mock = DOCTORS.find(d => d.id === id) || DOCTORS[0];
          setDoctor({
            ...mock,
            image: mock.image,
            clinics: mock.locations.map((loc, i) => ({
              id: `clinic-${i}`,
              name: `عيادة ${mock.name}`,
              address: loc,
              phone: '0770-123-4567',
            })),
            experience: '8+',
            license: 'BMDC-54124',
            qualifications: 'بكالوريوس الطب، دبلوم تخصصي',
            about: 'يقدم الطبيب رعاية صحية متميزة مع استخدام أحدث التقنيات العلاجية لتلبية احتياجات المرضى وضمان أعلى مستويات الأمان والجودة.',
          });
          setWeeklySessions([
            { day: 'الأحد',    short: 'أحد', sessions: 4 },
            { day: 'الاثنين',  short: 'إثن', sessions: 7 },
            { day: 'الثلاثاء', short: 'ثلا', sessions: 3 },
            { day: 'الأربعاء', short: 'أرب', sessions: 8 },
            { day: 'الخميس',  short: 'خمس', sessions: 5 },
            { day: 'الجمعة',  short: 'جمع', sessions: 2 },
            { day: 'السبت',   short: 'سبت', sessions: 6 },
          ]);
          setTotalSessionsCount(3500);
        }
      } catch (error) {
        console.error('Error fetching doctor:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchDoctor();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-slate-500 font-medium">جاري تحميل ملف الطبيب...</p>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 font-bold text-lg">الطبيب غير موجود</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-indigo-600 font-bold underline">العودة</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-12 space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors group"
      >
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        العودة للقائمة
      </button>

      {/* ── FULL-BLEED PROFILE HEADER ── */}
      <div className="relative rounded-3xl overflow-hidden bg-white border border-slate-100 shadow-xl shadow-slate-100">
        {/* Cover image with gradient overlay */}
        <div className="relative h-52 md:h-64">
          <DoctorAvatar
            name={doctor.name}
            className="w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(15,23,42,0.85) 100%)' }}
          />
          {/* Name on cover */}
          <div className="absolute bottom-0 right-0 left-0 p-6">
            <div className="flex items-end gap-3">
              <div className="flex-1 text-right">
                <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">{doctor.name}</h1>
                <p className="text-white/80 font-medium mt-0.5">{doctor.qualifications || 'بكالوريوس الطب، دبلوم تخصصي'}</p>
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm border border-white/20 rounded-2xl px-3 py-2 flex-shrink-0">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="font-black text-white">{doctor.rating}</span>
                <span className="text-white/60 text-xs">({doctor.reviews})</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pills row */}
        <div className="px-6 py-4 flex flex-wrap gap-2 border-b border-slate-50">
          <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5">
            {doctor.specialization}
          </span>
          <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-1.5 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            طبيب موثق
          </span>
          {doctor.complex_name ? (
            <span className="text-xs font-black text-indigo-750 bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-1.5">
              مجمع: {doctor.complex_name}
            </span>
          ) : (
            <span className="text-xs font-black text-slate-500 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
              عيادة مستقلة
            </span>
          )}
          <span className="text-xs font-black text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5">
            متاح اليوم
          </span>
        </div>

        {/* Stats row — inspired by screenshot */}
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-50 px-6 py-5">
          <div className="text-center px-4">
            <p className="text-2xl font-black text-slate-900">{doctor.experience || '8+'}</p>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">سنوات الخبرة</p>
          </div>
          <div className="text-center px-4">
            <p className="text-2xl font-black text-slate-900">{doctor.rating} <span className="text-amber-400 text-lg">★</span></p>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">التقييم العام</p>
          </div>
          <div className="text-center px-4">
            <p className="text-2xl font-black text-slate-900 font-mono">{doctor.license || 'L-54124'}</p>
            <p className="text-[11px] font-bold text-slate-400 mt-0.5">رقم الترخيص</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left column */}
        <div className="lg:col-span-3 space-y-5">
          {/* About */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm text-right space-y-3">
            <h2 className="font-black text-slate-900 text-base">نبذة عن الطبيب</h2>
            <p className="text-slate-600 leading-relaxed text-sm font-medium">
              {doctor.about}
            </p>
            <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-50 mt-3">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">الاستشارات</p>
                <p className="font-black text-slate-800 text-sm mt-0.5">{totalSessionsCount > 0 ? `+${totalSessionsCount}` : '0'} جلسة</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">الاستجابة</p>
                <p className="font-black text-slate-800 text-sm mt-0.5">أقل من ساعة</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase">اللغات</p>
                <p className="font-black text-slate-800 text-sm mt-0.5">عربي، إنجليزي</p>
              </div>
            </div>
          </div>

          {/* Weekly Sessions Chart */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <div className="text-right mb-5">
              <h2 className="font-black text-slate-900 text-base">جلسات الحجز الأسبوعية</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">معدل الحجوزات الفعلي لهذا الأسبوع</p>
            </div>
            {(() => {
              const maxVal = Math.max(5, ...weeklySessions.map(w => w.sessions || 0));
              return (
                <>
                  <div className="flex items-end justify-between gap-2 h-36">
                    {weeklySessions.map((item, i) => {
                      const heightPct = ((item.sessions || 0) / maxVal) * 100;
                      const isMax = item.sessions > 0 && item.sessions === Math.max(...weeklySessions.map(w => w.sessions || 0));
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2">
                          <div className="w-full rounded-full bg-slate-100 overflow-hidden h-28 flex items-end">
                            <div
                              className="w-full rounded-full transition-all duration-700"
                              style={{
                                height: `${heightPct}%`,
                                background: isMax
                                  ? 'linear-gradient(to top, #3730a3, #818cf8)'
                                  : 'linear-gradient(to top, #4f46e5, #a5b4fc)',
                                opacity: item.sessions > 0 ? (isMax ? 1 : 0.7) : 0.2,
                              }}
                            />
                          </div>
                          <span className="text-[9px] font-black text-slate-400">{item.short}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-400 mt-3 pt-3 border-t border-slate-50">
                    <span>إجمالي حجوزات الأسبوع: {weeklySessions.reduce((s, w) => s + (w.sessions || 0), 0)} جلسات</span>
                    <span>الحد الأقصى لليوم: {maxVal} جلسات</span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Right column — Booking */}
        <div className="lg:col-span-2 space-y-5">
          {/* Price & Book */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm space-y-5 text-right">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-black uppercase">رسوم الكشفية</span>
                <p className="text-2xl font-black text-slate-900">{(doctor.price || 150000).toLocaleString()}<span className="text-sm text-slate-400 font-bold"> د.ع</span></p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <CalendarIcon className="w-6 h-6 text-indigo-500" />
              </div>
            </div>

            {/* Trust signals */}
            <div className="space-y-2 text-xs font-bold text-slate-500">
              <div className="flex items-center gap-2 justify-end">
                <span>تأكيد فوري للحجز</span>
                <div className="w-6 h-6 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                </div>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span>إلغاء مجاني قبل 24 ساعة</span>
                <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-3.5 h-3.5 text-blue-500" />
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(`/book/${doctor.id}`)}
              className="w-full py-4 rounded-2xl font-black text-base text-white transition-all hover:opacity-90 active:scale-[0.98] shadow-lg shadow-indigo-200"
              style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
            >
              احجز موعداً الآن
            </button>
          </div>

          {/* Clinics */}
          {doctor.clinics && doctor.clinics.length > 0 && (
            <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 text-right">
              <h3 className="font-black text-slate-800 text-sm">مواقع العيادات</h3>
              <div className="space-y-3">
                {doctor.clinics.map((clinic: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{clinic.name}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{clinic.address}</p>
                      {clinic.google_maps_link && (
                        <a
                           href={clinic.google_maps_link}
                           target="_blank"
                           rel="noreferrer"
                           className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1 transition-all"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          عرض الموقع على الخريطة
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
