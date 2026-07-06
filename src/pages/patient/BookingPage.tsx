import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { MapPin, Clock, Calendar as CalIcon, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

// Generate hourly slots between start and end (e.g. "09:00" → "17:00")
function generateSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh] = end.split(':').map(Number);
  for (let h = sh; h < eh; h++) {
    slots.push(`${String(h).padStart(2, '0')}:${String(sm).padStart(2, '0')}`);
    if (sm === 0) slots.push(`${String(h).padStart(2, '0')}:30`);
  }
  return slots;
}

const DAY_MAP: Record<number, string> = {
  0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
  4: 'Thursday', 5: 'Friday', 6: 'Saturday',
};

const DAY_AR: Record<string, string> = {
  Sunday: 'الأحد', Monday: 'الاثنين', Tuesday: 'الثلاثاء',
  Wednesday: 'الأربعاء', Thursday: 'الخميس', Friday: 'الجمعة', Saturday: 'السبت',
};

// Proper short Arabic names — do NOT slice Arabic strings by index
const DAY_AR_SHORT: Record<string, string> = {
  Sunday: 'أحد', Monday: 'إثن', Tuesday: 'ثلا',
  Wednesday: 'أرب', Thursday: 'خمس', Friday: 'جمع', Saturday: 'سبت',
};

// Build a 30-day calendar starting today
function buildCalendar() {
  const today = startOfDay(new Date());
  return Array.from({ length: 30 }, (_, i) => addDays(today, i));
}

export default function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [doctor, setDoctor] = useState<any>(null);
  const [clinics, setClinics] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedClinic, setSelectedClinic] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [booking, setBooking] = useState(false);

  const days = buildCalendar();

  // ── Fetch doctor + clinics + schedule ──────────────────
  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      try {
        // Try SECURITY DEFINER RPC first (bypasses RLS)
        let doc: any = null;
        const { data: rpcData, error: rpcErr } = await supabase
          .rpc('get_user_by_id', { p_id: id });

        if (rpcErr) {
          console.warn('get_user_by_id RPC failed, falling back to direct query:', rpcErr.message);
          // Fallback: direct query (requires RLS policy to allow it)
          const { data: directData, error: directErr } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .maybeSingle();
          if (directErr) console.error('Direct query error:', directErr.message);
          doc = directData;
        } else {
          // rpc returns an array (SETOF), grab first row
          doc = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        }

        console.log('Doctor fetched:', doc);
        setDoctor(doc || null);

        if (doc) {
          const { data: clinicData } = await supabase
            .from('clinics').select('*').eq('doctor_id', id);
          setClinics(clinicData || []);
          if (clinicData && clinicData.length > 0) setSelectedClinic(clinicData[0].id);

          const { data: schedData } = await supabase
            .from('doctor_schedules').select('*').eq('doctor_id', id);
          setSchedules(schedData || []);
        }
      } catch (e: any) {
        console.error('BookingPage fetch error:', e.message || e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);


  // ── Fetch booked times for selected date ───────────────
  const fetchBookedTimes = useCallback(async (date: Date) => {
    if (!id) return;
    setCheckingSlots(true);
    try {
      // get_booked_slots is SECURITY DEFINER + granted to anon
      // so it works even when the patient has no Supabase Auth session
      const { data, error } = await supabase
        .rpc('get_booked_slots', {
          p_doctor_id: id,
          p_date: format(date, 'yyyy-MM-dd'),
        });
      if (error) {
        console.warn('get_booked_slots RPC error:', error.message);
        setBookedTimes([]);
      } else {
        setBookedTimes((data || []).map((b: any) => (b.start_time || '').slice(0, 5)));
      }
    } catch { setBookedTimes([]); }
    finally { setCheckingSlots(false); }
  }, [id]);


  useEffect(() => {
    fetchBookedTimes(selectedDate);
    setSelectedTime(''); // reset time on date change
  }, [selectedDate, fetchBookedTimes]);

  // ── Compute available slots ────────────────────────────
  const dayName = DAY_MAP[selectedDate.getDay()];
  const scheduleDay = schedules.find(s => s.day_of_week === dayName);
  const isDayOpen = scheduleDay?.is_open ?? true; 
  const allSlots = isDayOpen && scheduleDay
    ? generateSlots(scheduleDay.start_time || '09:00', scheduleDay.end_time || '17:00')
    : isDayOpen
      ? generateSlots('09:00', '17:00')
      : [];

  // ── Book ───────────────────────────────────────────────
  const handleBook = async () => {
    if (!user || !doctor || !selectedTime || !selectedDate) return;
    setBooking(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const clinic = clinics.find(c => c.id === selectedClinic);
      const timeStr = selectedTime.length === 5 ? `${selectedTime}:00` : selectedTime;

      // Final conflict check via RPC (works for anon patients)
      const { data: slots } = await supabase
        .rpc('get_booked_slots', {
          p_doctor_id: doctor.id,
          p_date: dateStr,
        });
      const conflict = (slots || []).some(
        (s: any) => (s.start_time || '').slice(0, 5) === selectedTime
      );

      if (conflict) {
        alert('هذا الوقت محجوز بالفعل، يرجى اختيار وقت آخر.');
        await fetchBookedTimes(selectedDate);
        setSelectedTime('');
        return;
      }

      navigate('/payment', {
        state: {
          doctorId: doctor.id,
          doctorName: doctor.name,
          price: doctor.price,
          date: dateStr,
          time: selectedTime,
          clinic: clinic?.name || 'العيادة',
          clinicId: clinic?.id || null,
        }
      });
    } catch (e: any) {
      alert('حدث خطأ: ' + e.message);
    } finally {
      setBooking(false);
    }
  };

  // ── Loading / not found ────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-3">
      <Loader2 className="w-9 h-9 text-indigo-500 animate-spin" />
      <p className="text-slate-500 font-medium text-sm">جاري تحميل بيانات الطبيب...</p>
    </div>
  );

  if (!doctor) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center">
        <CalIcon className="w-7 h-7 text-red-400" />
      </div>
      <p className="font-black text-slate-900">لم يتم العثور على الطبيب</p>
      <p className="text-xs text-slate-400 max-w-xs">عذراً، لم نتمكن من العثور على ملف هذا الطبيب.</p>
      <button onClick={() => navigate(-1)} className="mt-2 text-sm font-bold text-indigo-600 hover:underline">رجوع</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto pb-12 space-y-6" dir="rtl">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-2xl bg-white border-2 border-slate-200 flex items-center justify-center text-slate-600 hover:border-indigo-300 transition-all">
          <ArrowRight className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900">حجز موعد</h1>
          <p className="text-sm text-slate-500 font-medium">{doctor.name} · {doctor.specialization || 'طبيب'}</p>
        </div>
      </div>

      {/* ── Date Picker ─────────────────────────────────── */}
      <div className="bg-white rounded-3xl border-2 border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-4 text-right">
          <CalIcon className="w-4 h-4 text-indigo-500" />
          <h2 className="font-black text-slate-900 text-sm">اختر التاريخ</h2>
        </div>

        {/* Scrollable day strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" dir="ltr">
          {days.map((day) => {
            const dName = DAY_MAP[day.getDay()];
            const sched = schedules.find(s => s.day_of_week === dName);
            const isOpen = sched?.is_open ?? true;
            const isSelected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
            const isPast = isBefore(day, startOfDay(new Date())) && !isSelected;
            return (
              <button key={day.toISOString()} disabled={!isOpen || isPast}
                onClick={() => setSelectedDate(day)}
                className={`flex-shrink-0 w-16 py-3 rounded-2xl flex flex-col items-center gap-1 transition-all border-2 ${
                  isSelected ? 'text-white border-transparent shadow-lg' :
                  !isOpen ? 'text-slate-300 bg-slate-50 border-slate-100 cursor-not-allowed' :
                  'text-slate-600 bg-slate-50 border-slate-200 hover:border-indigo-300'
                }`}
                style={isSelected ? { background: 'linear-gradient(135deg,#3730a3,#4f46e5)' } : {}}>
                <span className="text-[9px] font-bold leading-tight">{DAY_AR[dName]}</span>
                <span className="text-base font-black">{format(day, 'd')}</span>
                <span className="text-[9px] font-medium">{format(day, 'MMM', { locale: arSA })}</span>
                {!isOpen && <span className="text-[8px] text-red-400 font-bold">مغلق</span>}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-slate-400 mt-3 font-medium">
          {DAY_AR[dayName]} · {format(selectedDate, 'd MMMM yyyy', { locale: arSA })}
        </p>
      </div>

      {/* ── Time Slots ──────────────────────────────────── */}
      <div className="bg-white rounded-3xl border-2 border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-300 inline-block" />متاح
            <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />محجوز
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <h2 className="font-black text-slate-900 text-sm">اختر الوقت</h2>
          </div>
        </div>

        {checkingSlots ? (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            <span className="text-sm text-slate-500">جاري التحقق من المواعيد...</span>
          </div>
        ) : !isDayOpen ? (
          <p className="text-center text-slate-400 font-bold py-8">الطبيب لا يعمل في هذا اليوم</p>
        ) : allSlots.length === 0 ? (
          <p className="text-center text-slate-400 font-bold py-8">لا توجد مواعيد متاحة</p>
        ) : (
          <div className="grid grid-cols-4 gap-2" dir="ltr">
            {allSlots.map(slot => {
              const isBooked = bookedTimes.includes(slot);
              const isChosen = selectedTime === slot;
              return (
                <button key={slot} disabled={isBooked}
                  onClick={() => setSelectedTime(slot)}
                  className={`py-2.5 rounded-2xl text-sm font-bold border-2 transition-all ${
                    isChosen    ? 'text-white border-transparent shadow-md' :
                    isBooked    ? 'text-red-300 bg-red-50 border-red-200 cursor-not-allowed line-through' :
                    'text-slate-700 bg-slate-50 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50'
                  }`}
                  style={isChosen ? { background: 'linear-gradient(135deg,#3730a3,#4f46e5)' } : {}}>
                  {slot}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Clinic ──────────────────────────────────────── */}
      {clinics.length > 0 && (
        <div className="bg-white rounded-3xl border-2 border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4 justify-end">
            <h2 className="font-black text-slate-900 text-sm">اختر العيادة</h2>
            <MapPin className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="space-y-2">
            {clinics.map(c => (
              <button key={c.id} onClick={() => setSelectedClinic(c.id)}
                className={`w-full p-4 rounded-2xl border-2 text-right transition-all flex items-center justify-between ${
                  selectedClinic === c.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300'
                }`}>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedClinic === c.id ? 'border-indigo-500' : 'border-slate-300'}`}>
                  {selectedClinic === c.id && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                </div>
                <div className="flex-1 text-right flex items-center justify-between gap-2 mr-3">
                  {c.google_maps_link ? (
                    <a
                      href={c.google_maps_link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-white border border-indigo-100 rounded-xl px-2.5 py-1.5 flex items-center gap-1 transition-all shadow-sm flex-shrink-0"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      عرض على الخريطة
                    </a>
                  ) : <div />}
                  <div>
                    <p className="font-black text-slate-900 text-sm">{c.name}</p>
                    {c.address && <p className="text-xs text-slate-400 mt-0.5">{c.address}</p>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary + Confirm ───────────────────────────── */}
      <div className="rounded-3xl p-5 text-white space-y-4" style={{ background: 'linear-gradient(135deg,#3730a3,#4f46e5)' }}>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between opacity-80">
            <span className="font-bold">{doctor.name}</span>
            <span>الطبيب</span>
          </div>
          <div className="flex justify-between opacity-80">
            <span className="font-bold">{format(selectedDate, 'd MMMM yyyy', { locale: arSA })}</span>
            <span>التاريخ</span>
          </div>
          <div className="flex justify-between opacity-80">
            <span className="font-bold">{selectedTime || '—'}</span>
            <span>الوقت</span>
          </div>
          <div className="flex justify-between opacity-80">
            <span className="font-bold">{(doctor.price || 0).toLocaleString('ar-IQ')} د.ع</span>
            <span>الرسوم</span>
          </div>
        </div>

        <div className="h-px bg-white/20" />

        <button
          onClick={handleBook}
          disabled={!selectedTime || !selectedDate || booking}
          className="w-full h-13 bg-white text-indigo-700 font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {booking ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
          {booking ? 'جاري التحقق...' : 'تأكيد الحجز والمتابعة للدفع'}
        </button>
      </div>

    </div>
  );
}
