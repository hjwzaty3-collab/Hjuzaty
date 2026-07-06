import { useState, useEffect } from 'react';
import { Clock, Save, AlertCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

const DAYS = [
  { en: 'Monday', ar: 'الاثنين' },
  { en: 'Tuesday', ar: 'الثلاثاء' },
  { en: 'Wednesday', ar: 'الأربعاء' },
  { en: 'Thursday', ar: 'الخميس' },
  { en: 'Friday', ar: 'الجمعة' },
  { en: 'Saturday', ar: 'السبت' },
  { en: 'Sunday', ar: 'الأحد' },
];

const TIMES = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00',
];

const formatTime = (t: string) => {
  const [h] = t.split(':');
  const hour = parseInt(h);
  const ampm = hour < 12 ? 'ص' : 'م';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:00 ${ampm}`;
};

const DURATIONS = [
  { value: '15', label: '15 دقيقة' },
  { value: '30', label: '30 دقيقة' },
  { value: '45', label: '45 دقيقة' },
  { value: '60', label: 'ساعة كاملة' },
];

export default function ScheduleManagementPage() {
  const user = useAuthStore((s) => s.user);
  const [schedule, setSchedule] = useState(
    DAYS.map(day => ({ ...day, isOpen: day.en !== 'Friday', start: '09:00', end: '17:00' }))
  );
  const [duration, setDuration] = useState('30');
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) fetchSchedule(); }, [user]);

  const fetchSchedule = async () => {
    if (!user) return;
    try {
      // Use SECURITY DEFINER RPC — works for anon (non-Supabase-Auth) doctors
      const { data, error } = await supabase
        .rpc('get_doctor_schedule', { p_doctor_id: user.id });
      if (error) { console.error('get_doctor_schedule:', error.message); return; }
      if (data && data.length > 0) {
        setSchedule(prev => prev.map(s => {
          const r = data.find((x: any) => x.day_of_week === s.en);
          return r ? { ...s, isOpen: r.is_open, start: r.start_time?.slice(0, 5) || '09:00', end: r.end_time?.slice(0, 5) || '17:00' } : s;
        }));
      }
    } catch (e) { console.error(e); }
  };

  const handleToggle = (dayEn: string) =>
    setSchedule(prev => prev.map(s => s.en === dayEn ? { ...s, isOpen: !s.isOpen } : s));

  const handleTime = (dayEn: string, field: 'start' | 'end', value: string) =>
    setSchedule(prev => prev.map(s => s.en === dayEn ? { ...s, [field]: value } : s));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Call upsert_schedule for each day via SECURITY DEFINER RPC
      const promises = schedule.map(s =>
        supabase.rpc('upsert_schedule', {
          p_doctor_id:  user.id,
          p_day:        s.en,
          p_is_open:    s.isOpen,
          p_start_time: s.start,
          p_end_time:   s.end,
        })
      );
      const results = await Promise.all(promises);
      const failed = results.find(r => r.error);
      if (failed?.error) throw new Error(failed.error.message);
      toast.success('تم حفظ الجدول بنجاح ✓');
    } catch (e: any) {
      console.error('upsert_schedule error:', e.message);
      toast.error('فشل حفظ الجدول: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const openCount = schedule.filter(s => s.isOpen).length;

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl transition-all hover:opacity-90 disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
        >
          <Save className="w-4 h-4" />
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">إدارة الجدول الزمني</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">مفتوح {openCount} أيام هذا الأسبوع</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Schedule */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 text-right">
            <h2 className="font-black text-slate-900">ساعات العمل الأسبوعية</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">فعّل الأيام وحدد أوقات الدوام</p>
          </div>
          <div className="divide-y divide-slate-50">
            {schedule.map((item) => (
              <div key={item.en} className={`flex items-center justify-between px-6 py-4 transition-colors ${item.isOpen ? 'bg-white' : 'bg-slate-50/50'}`}>
                {/* Time pickers — only shown when open */}
                <div className="flex items-center gap-2">
                  {item.isOpen ? (
                    <>
                      <select
                        value={item.end}
                        onChange={e => handleTime(item.en, 'end', e.target.value)}
                        className="h-9 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-700 font-bold text-xs px-2 focus:outline-none focus:border-indigo-400 cursor-pointer"
                      >
                        {TIMES.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                      </select>
                      <span className="text-slate-300 text-xs font-bold">←</span>
                      <select
                        value={item.start}
                        onChange={e => handleTime(item.en, 'start', e.target.value)}
                        className="h-9 rounded-xl border-2 border-slate-100 bg-slate-50 text-slate-700 font-bold text-xs px-2 focus:outline-none focus:border-indigo-400 cursor-pointer"
                      >
                        {TIMES.map(t => <option key={t} value={t}>{formatTime(t)}</option>)}
                      </select>
                      <Clock className="w-4 h-4 text-slate-300" />
                    </>
                  ) : (
                    <span className="text-xs text-slate-400 font-bold italic">مغلق</span>
                  )}
                </div>

                {/* Day name + Toggle */}
                <div className="flex items-center gap-3">
                  <span className={`font-black text-sm ${item.isOpen ? 'text-slate-800' : 'text-slate-400'}`}>{item.ar}</span>
                  {/* Custom toggle */}
                  <button
                    onClick={() => handleToggle(item.en)}
                    className={`relative w-11 h-6 rounded-full transition-all duration-300 ${item.isOpen ? '' : 'bg-slate-200'}`}
                    style={item.isOpen ? { background: 'linear-gradient(135deg, #3730a3, #4f46e5)' } : {}}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${item.isOpen ? 'right-1' : 'right-6'}`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Session duration */}
          <div className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-4 text-right">
            <div>
              <h3 className="font-black text-slate-900">مدة الجلسة</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">كم تستغرق كل استشارة؟</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setDuration(d.value)}
                  className={`py-3 rounded-2xl text-xs font-black border-2 transition-all ${duration === d.value ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day-off */}
          <div className="rounded-3xl border-2 border-amber-100 bg-amber-50 p-5 space-y-4 text-right">
            <div className="flex items-center justify-end gap-2">
              <div>
                <h3 className="font-black text-amber-800">إغلاق يوم محدد</h3>
                <p className="text-xs text-amber-700/70 font-medium mt-0.5">للإجازات أو الطوارئ</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <button className="w-full py-3 rounded-2xl bg-white border-2 border-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors">
              <Calendar className="w-4 h-4" />
              اختر تاريخاً
            </button>
            <select className="w-full h-11 pr-4 rounded-xl border-2 border-amber-100 bg-white text-slate-600 font-bold text-sm focus:outline-none focus:border-amber-300">
              <option value="">السبب (اختياري)</option>
              <option value="personal">إجازة شخصية</option>
              <option value="holiday">عطلة رسمية</option>
              <option value="emergency">حالة طارئة</option>
            </select>
            <button className="w-full py-3 rounded-2xl bg-amber-500 text-white font-black text-sm hover:bg-amber-600 transition-colors">
              تأكيد الإغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
