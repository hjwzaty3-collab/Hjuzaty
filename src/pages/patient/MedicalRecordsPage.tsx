import { useState, useEffect } from 'react';
import { FileText, Calendar, User, Download, ExternalLink, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export default function MedicalRecordsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchRecords();
    if (!isValidUUID(user.id)) return;
    const ch = supabase.channel(`med-rec-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'medical_records', filter: `patient_id=eq.${user.id}` }, fetchRecords)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const fetchRecords = async () => {
    if (!user) return;
    try {
      if (!isValidUUID(user.id)) { setRecords([]); return; }
      const { data, error } = await supabase
        .from('medical_records')
        .select('*, doctor:doctor_id (name)')
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRecords(data.map((r: any) => ({
        id: r.id,
        diagnosis: r.diagnosis,
        date: new Date(r.created_at).toLocaleDateString('ar-IQ'),
        doctorName: (Array.isArray(r.doctor) ? r.doctor[0]?.name : r.doctor?.name) || 'طبيب',
        prescription: r.prescription,
        notes: r.notes,
        nextVisit: r.next_visit || null,
      })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-medium text-sm">جاري تحميل سجلاتك الطبية...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button className="flex items-center gap-2 text-sm font-bold text-slate-600 border-2 border-slate-100 hover:border-slate-200 px-4 py-2.5 rounded-2xl transition-all">
          <Download className="w-4 h-4" />
          تصدير الكل
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">السجلات الطبية</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">{records.length} سجل طبي</p>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center">
            <FileText className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-500 font-bold">لا توجد سجلات طبية بعد</p>
          <button onClick={() => navigate('/doctors')}
            className="text-sm font-bold text-white px-5 py-2.5 rounded-2xl hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
            احجز موعدك الأول
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map(record => (
            <div key={record.id} className="bg-white rounded-3xl border border-slate-100 hover:border-indigo-100 hover:shadow-md transition-all overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-slate-50">
                <div className="flex items-center gap-3">
                  <button className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors">
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => navigate('/doctors')}
                    className="w-8 h-8 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-black text-slate-900">{record.diagnosis}</p>
                    <div className="flex items-center gap-3 mt-1 justify-end text-xs text-slate-400 font-bold">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{record.doctorName}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{record.date}</span>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)' }}>
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Prescription */}
                {record.prescription && (
                  <div className="md:col-span-1 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">الوصفة الطبية</p>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                      <p className="text-sm font-bold text-indigo-900 leading-relaxed">{record.prescription}</p>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {record.notes && (
                  <div className="md:col-span-1 space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">ملاحظات الطبيب</p>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                      <p className="text-sm text-slate-700 leading-relaxed">{record.notes}</p>
                    </div>
                  </div>
                )}

                {/* Next visit */}
                <div className="md:col-span-1 space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">الزيارة القادمة</p>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 justify-end">
                      <p className="font-black text-emerald-800 text-sm">{record.nextVisit || 'غير محدد'}</p>
                      <Calendar className="w-4 h-4 text-emerald-600" />
                    </div>
                    <button onClick={() => navigate('/doctors')}
                      className="w-full py-2 rounded-xl font-bold text-xs text-white hover:opacity-90 transition-all"
                      style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                      حجز متابعة
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
