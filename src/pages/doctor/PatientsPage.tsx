import { useState, useEffect } from 'react';
import {
  Search, Phone, Mail, Calendar, Users, Loader2, ChevronDown, ChevronUp,
  FileText, Stethoscope, Pill, Clock, CheckCircle2, Activity,
  CalendarDays, Hash
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

interface Patient {
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  patient_email: string;
  total_bookings: number;
  completed_visits: number;
  last_visit_date: string;
  first_visit_date: string;
  record_count: number;
}

interface MedicalRecord {
  record_id: string;
  created_at: string;
  diagnosis: string;
  prescription: string;
  notes: string;
  next_visit: string;
  booking_id: string;
  booking_date: string;
  start_time: string;
}

export default function PatientsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [recordsMap, setRecordsMap] = useState<Record<string, MedicalRecord[]>>({});
  const [recordsLoading, setRecordsLoading] = useState<Record<string, boolean>>({});

  useEffect(() => { if (user) fetchPatients(); }, [user]);

  const fetchPatients = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_doctor_patients', { p_doctor_id: user.id });
      if (error) throw error;
      setPatients(data || []);
    } catch (e) {
      console.error('fetchPatients error:', e);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async (patientId: string) => {
    if (recordsMap[patientId]) return; // already loaded
    setRecordsLoading(prev => ({ ...prev, [patientId]: true }));
    try {
      const { data, error } = await supabase.rpc('get_patient_records_for_doctor', {
        p_doctor_id: user!.id,
        p_patient_id: patientId,
      });
      if (error) throw error;
      setRecordsMap(prev => ({ ...prev, [patientId]: data || [] }));
    } catch (e) {
      console.error('fetchRecords error:', e);
      setRecordsMap(prev => ({ ...prev, [patientId]: [] }));
    } finally {
      setRecordsLoading(prev => ({ ...prev, [patientId]: false }));
    }
  };

  const toggleExpand = (patientId: string) => {
    if (expandedId === patientId) {
      setExpandedId(null);
    } else {
      setExpandedId(patientId);
      fetchRecords(patientId);
    }
  };

  const filtered = patients.filter(p =>
    p.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.patient_phone?.includes(searchQuery)
  );

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

  const fmtTime = (t: string | null) =>
    t ? t.substring(0, 5) : '';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-medium text-sm">جاري تحميل المرضى...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">المرضى</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">
            {patients.length} مريض في سجلاتك
          </p>
        </div>
        <div className="relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث بالاسم أو الهاتف..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-11 pr-11 pl-4 rounded-2xl border-2 border-slate-100 bg-white text-slate-800 font-medium placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-400 transition-all w-64"
          />
        </div>
      </div>

      {/* ── Stats Strip ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'إجمالي المرضى', value: patients.length, icon: Users, color: 'indigo' },
          { label: 'زيارات مكتملة', value: patients.reduce((s, p) => s + Number(p.completed_visits), 0), icon: CheckCircle2, color: 'emerald' },
          { label: 'سجلات طبية', value: patients.reduce((s, p) => s + Number(p.record_count), 0), icon: FileText, color: 'violet' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 p-4 text-right">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${
              stat.color === 'indigo' ? 'bg-indigo-50' : stat.color === 'emerald' ? 'bg-emerald-50' : 'bg-violet-50'
            }`}>
              <stat.icon className={`w-4 h-4 ${
                stat.color === 'indigo' ? 'text-indigo-600' : stat.color === 'emerald' ? 'text-emerald-600' : 'text-violet-600'
              }`} />
            </div>
            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Empty State ── */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-5">
            <Users className="w-9 h-9 text-slate-300" />
          </div>
          <h3 className="text-lg font-black text-slate-700 mb-2">لا توجد مرضى بعد</h3>
          <p className="text-slate-400 font-medium text-sm">ستظهر هنا قائمة مرضاك بعد أول حجز</p>
        </div>
      )}

      {/* ── Patient Cards ── */}
      <div className="space-y-3">
        {filtered.map((patient) => {
          const isOpen = expandedId === patient.patient_id;
          const records = recordsMap[patient.patient_id];
          const isLoadingRec = recordsLoading[patient.patient_id];
          const initials = patient.patient_name?.split(' ').map(w => w[0]).slice(0, 2).join('') || '؟';

          return (
            <div
              key={patient.patient_id}
              className="bg-white rounded-3xl border border-slate-100 overflow-hidden transition-all duration-300"
              style={{ boxShadow: isOpen ? '0 8px 30px rgba(79,70,229,0.08)' : '0 1px 3px rgba(0,0,0,0.04)' }}
            >
              {/* ── Card Header (always visible) ── */}
              <div className="p-5" dir="rtl">
                <div className="flex items-start gap-4">

                  {/* Avatar — right side in RTL */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-white text-lg flex-shrink-0 select-none"
                    style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                  >
                    {initials}
                  </div>

                  {/* Info — fills remaining space, all right-aligned */}
                  <div className="flex-1 min-w-0 text-right">

                    {/* Name */}
                    <h3 className="font-black text-slate-900 text-base">{patient.patient_name}</h3>

                    {/* Stat pills */}
                    <div className="flex items-center gap-2 flex-wrap mt-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold">
                        <Hash className="w-3 h-3" />
                        {patient.total_bookings} حجز
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                        <CheckCircle2 className="w-3 h-3" />
                        {patient.completed_visits} مكتملة
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-violet-50 text-violet-700 text-xs font-bold">
                        <FileText className="w-3 h-3" />
                        {patient.record_count} سجل
                      </span>
                    </div>

                    {/* Contact row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                      {patient.patient_phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5" />
                          <span dir="ltr">{patient.patient_phone}</span>
                        </span>
                      )}
                      {patient.patient_email && (
                        <span className="flex items-center gap-1.5 text-xs truncate max-w-[200px]">
                          <Mail className="w-3.5 h-3.5" />
                          {patient.patient_email}
                        </span>
                      )}
                    </div>

                    {/* Dates */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        آخر زيارة: {fmtDate(patient.last_visit_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        أول زيارة: {fmtDate(patient.first_visit_date)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action buttons — right-to-left order */}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => toggleExpand(patient.patient_id)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-black text-indigo-600 border-2 border-indigo-100 bg-indigo-50 hover:bg-indigo-100 transition-all"
                  >
                    {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {isOpen ? 'إخفاء السجلات' : 'عرض السجلات'}
                  </button>
                  <button
                    onClick={() => navigate(`/doctor/medical-records?patient=${patient.patient_name}&patientId=${patient.patient_id}`)}
                    className="px-4 py-2 rounded-2xl text-xs font-black text-white transition-all"
                    style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                  >
                    سجل جديد
                  </button>
                </div>
              </div>

              {/* ── Expanded Medical Records ── */}
              {isOpen && (
                <div className="border-t border-slate-50 bg-slate-50/60 p-5 space-y-4" dir="rtl">
                  <h4 className="text-sm font-black text-slate-700 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-500" />
                    السجلات الطبية
                  </h4>

                  {isLoadingRec && (
                    <div className="flex justify-center py-6">
                      <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                    </div>
                  )}

                  {!isLoadingRec && records && records.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-6">لا توجد سجلات طبية مدونة لهذا المريض</p>
                  )}

                  {!isLoadingRec && records && records.map((rec) => (
                    <div
                      key={rec.record_id}
                      className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3"
                    >
                      {/* Record date/time */}
                      <div className="flex items-center justify-between">
                        {rec.booking_date && (
                          <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl">
                            <Clock className="w-3 h-3" />
                            {fmtDate(rec.booking_date)}{rec.start_time ? ` — ${fmtTime(rec.start_time)}` : ''}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-medium">
                          {new Date(rec.created_at).toLocaleDateString('ar-IQ', {
                            year: 'numeric', month: 'long', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Diagnosis */}
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Stethoscope className="w-4 h-4 text-rose-500" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-400 mb-0.5">التشخيص</p>
                          <p className="font-bold text-slate-900 text-sm">{rec.diagnosis}</p>
                        </div>
                      </div>

                      {rec.prescription && (
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Pill className="w-4 h-4 text-sky-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 mb-0.5">الوصفة الطبية</p>
                            <p className="text-slate-700 text-sm">{rec.prescription}</p>
                          </div>
                        </div>
                      )}

                      {rec.notes && (
                        <div className="flex items-start gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FileText className="w-4 h-4 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-400 mb-0.5">ملاحظات</p>
                            <p className="text-slate-600 text-sm">{rec.notes}</p>
                          </div>
                        </div>
                      )}

                      {rec.next_visit && (
                        <div className="flex items-center gap-2 pt-1 border-t border-slate-50">
                          <CalendarDays className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-xs font-medium text-slate-500">الزيارة القادمة: <strong className="text-emerald-700">{rec.next_visit}</strong></span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
