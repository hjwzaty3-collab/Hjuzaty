import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Save, ArrowRight, Stethoscope, Pill, FileText, CalendarDays, Clock,
  User, ChevronDown, ChevronUp, Activity, Loader2, Plus, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { notifyAppointmentStatus } from '@/services/notificationService';

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

interface PatientDetails {
  id: string;
  name: string;
  blood_group: string;
  weight: number;
  phone: string;
}

const isValidUUID = (id: string | null) =>
  id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : false;

export default function DoctorMedicalRecordsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const patientId  = searchParams.get('patientId');
  const bookingId  = searchParams.get('bookingId');
  const patientName = searchParams.get('patient') || 'مريض';

  // If bookingId present → new record mode; otherwise view-only history mode
  const isNewRecordMode = isValidUUID(bookingId);

  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null);
  const [history, setHistory] = useState<MedicalRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  // Form state
  const [diagnosis, setDiagnosis]     = useState('');
  const [prescription, setPrescription] = useState('');
  const [notes, setNotes]             = useState('');
  const [nextVisit, setNextVisit]     = useState('');
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    if (patientId) {
      fetchPatientProfile();
      fetchHistory();
    }
  }, [patientId]);

  const fetchPatientProfile = async () => {
    try {
      const { data, error } = await supabase.rpc('get_user_by_id', { p_id: patientId });
      if (error) throw error;
      setPatientDetails(data?.[0] ?? null);
    } catch (err) {
      console.error('fetchPatientProfile:', err);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      if (!user || !patientId) return;
      const { data, error } = await supabase.rpc('get_patient_records_for_doctor', {
        p_doctor_id: user.id,
        p_patient_id: patientId,
      });
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error('fetchHistory:', err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async () => {
    if (!diagnosis.trim()) {
      toast.error('يرجى إدخال التشخيص');
      return;
    }
    if (!user || !patientId) return;
    setSaving(true);

    try {
      // 1. Insert medical record
      const { error } = await supabase.from('medical_records').insert([{
        patient_id: patientId,
        doctor_id:  user.id,
        booking_id: isValidUUID(bookingId) ? bookingId : null,
        diagnosis,
        prescription,
        notes,
        next_visit: nextVisit,
      }]);
      if (error) throw error;

      // 2. Mark booking as completed
      if (isValidUUID(bookingId)) {
        const { error: bErr } = await supabase.rpc('update_booking_status', {
          p_booking_id: bookingId,
          p_doctor_id:  user.id,
          p_status:     'COMPLETED',
        });
        if (bErr) throw bErr;

        // 3. Notify patient
        try {
          await notifyAppointmentStatus(patientId, bookingId!, 'COMPLETED', 'DOCTOR', true);
        } catch (_) {}
      }

      toast.success('تم حفظ السجل الطبي بنجاح');
      navigate('/doctor/bookings');
    } catch (err: any) {
      console.error('handleSave error:', err);
      toast.error('فشل حفظ السجل');
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const fmtTime = (t: string | null) => t ? t.substring(0, 5) : '';
  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const avatarInitials = (name: string) => name.split(' ').map(w => w[0]).slice(0, 2).join('');

  return (
    <div className="max-w-5xl mx-auto pb-10 space-y-6" dir="rtl">

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          رجوع
        </button>
        <div className="text-right">
          <h1 className="text-xl font-black text-slate-900">
            {isNewRecordMode ? 'تسجيل زيارة جديدة' : 'السجل الطبي'}
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-0.5">{patientDetails?.name || patientName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left column: Patient card + history ── */}
        <div className="space-y-5">

          {/* Patient Info Card */}
          <div
            className="rounded-3xl p-5 text-white space-y-4"
            style={{ background: 'linear-gradient(135deg, #3730a3 0%, #4f46e5 50%, #6d28d9 100%)' }}
          >
            <div className="flex items-center gap-4 justify-end">
              <div className="text-right">
                <h2 className="text-lg font-black">{patientDetails?.name || patientName}</h2>
                {patientDetails?.phone && (
                  <p className="text-sm text-white/70 mt-0.5" dir="ltr">{patientDetails.phone}</p>
                )}
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center font-black text-xl flex-shrink-0">
                {avatarInitials(patientDetails?.name || patientName)}
              </div>
            </div>

            <div className="h-px bg-white/20" />

            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'فصيلة الدم', value: patientDetails?.blood_group || '—' },
                { label: 'الوزن',      value: patientDetails?.weight ? `${patientDetails.weight} كغم` : '—' },
                { label: 'الهاتف',     value: patientDetails?.phone || '—' },
                { label: 'آخر زيارة', value: history[0] ? fmtDate(history[0].booking_date || history[0].created_at) : '—' },
              ].map(item => (
                <div key={item.label} className="text-right">
                  <p className="text-white/50 text-xs">{item.label}</p>
                  <p className="font-bold text-sm mt-0.5 break-all">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Visit History */}
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-end gap-2 px-5 pt-5 pb-3">
              <h3 className="font-black text-slate-900 text-sm">سجل الزيارات</h3>
              <Activity className="w-4 h-4 text-indigo-500" />
            </div>

            {historyLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              </div>
            )}

            {!historyLoading && history.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-8 px-4">لا توجد سجلات طبية سابقة</p>
            )}

            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {history.map(rec => (
                <div key={rec.record_id}>
                  <button
                    onClick={() => setExpandedRecord(expandedRecord === rec.record_id ? null : rec.record_id)}
                    className="w-full text-right px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedRecord === rec.record_id
                          ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                          : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        }
                        <div className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">{rec.diagnosis}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {rec.booking_date ? fmtDate(rec.booking_date) : fmtDate(rec.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                  {expandedRecord === rec.record_id && (
                    <div className="px-5 pb-4 bg-slate-50/60 space-y-2 text-sm text-right">
                      {rec.prescription && (
                        <p><span className="font-black text-slate-600">الوصفة: </span><span className="text-slate-700">{rec.prescription}</span></p>
                      )}
                      {rec.notes && (
                        <p><span className="font-black text-slate-600">ملاحظات: </span><span className="text-slate-600">{rec.notes}</span></p>
                      )}
                      {rec.next_visit && (
                        <p><span className="font-black text-emerald-700">الزيارة القادمة: </span><span className="text-emerald-700">{rec.next_visit}</span></p>
                      )}
                      <p className="text-xs text-slate-400">مُدوَّن في: {fmtDateTime(rec.created_at)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right column: Form (new record) or latest full record (view mode) ── */}
        <div className="lg:col-span-2 space-y-5">

          {isNewRecordMode ? (
            /* ── NEW RECORD FORM ── */
            <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
              {/* Form header */}
              <div
                className="px-6 py-5 flex items-center gap-3 justify-end"
                style={{ background: 'linear-gradient(135deg, #f0f0ff, #f5f3ff)' }}
              >
                <div className="text-right">
                  <h2 className="font-black text-slate-900">تسجيل زيارة جديدة</h2>
                  <p className="text-sm text-slate-500 mt-0.5">أدخل تفاصيل الاستشارة لإكمال الزيارة</p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Plus className="w-5 h-5 text-indigo-600" />
                </div>
              </div>

              <div className="p-6 space-y-5">
                {/* Diagnosis */}
                <div className="space-y-1.5">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2 justify-end">
                    التشخيص <span className="text-rose-500">*</span>
                    <Stethoscope className="w-4 h-4 text-rose-400" />
                  </label>
                  <textarea
                    rows={3}
                    placeholder="مثلاً: التهاب الشعب الهوائية الحاد..."
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    className="w-full rounded-2xl border-2 border-slate-100 focus:border-indigo-400 bg-slate-50 p-3.5 text-sm text-right resize-none outline-none transition-colors font-medium text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                {/* Prescription */}
                <div className="space-y-1.5">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2 justify-end">
                    الوصفة الطبية
                    <Pill className="w-4 h-4 text-sky-500" />
                  </label>
                  <textarea
                    rows={4}
                    placeholder="اسم الدواء، الجرعة، مدة العلاج..."
                    value={prescription}
                    onChange={e => setPrescription(e.target.value)}
                    className="w-full rounded-2xl border-2 border-slate-100 focus:border-indigo-400 bg-slate-50 p-3.5 text-sm text-right resize-none outline-none transition-colors font-medium text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2 justify-end">
                    ملاحظات سريرية
                    <FileText className="w-4 h-4 text-amber-500" />
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ملاحظات إضافية أو نصائح للمريض..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full rounded-2xl border-2 border-slate-100 focus:border-indigo-400 bg-slate-50 p-3.5 text-sm text-right resize-none outline-none transition-colors font-medium text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                {/* Next Visit */}
                <div className="space-y-1.5">
                  <label className="text-sm font-black text-slate-700 flex items-center gap-2 justify-end">
                    موعد الزيارة القادمة
                    <CalendarDays className="w-4 h-4 text-emerald-500" />
                  </label>
                  <input
                    type="date"
                    value={nextVisit}
                    onChange={e => setNextVisit(e.target.value)}
                    className="w-full rounded-2xl border-2 border-slate-100 focus:border-indigo-400 bg-slate-50 h-12 px-4 text-sm text-right outline-none transition-colors font-medium text-slate-800"
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full h-13 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      حفظ السجل وإكمال الزيارة
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* ── VIEW HISTORY MODE ── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500">{history.length} سجل طبي</span>
                <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                  كامل السجل الطبي
                  <Activity className="w-4 h-4 text-indigo-500" />
                </h2>
              </div>

              {historyLoading && (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                </div>
              )}

              {!historyLoading && history.length === 0 && (
                <div className="bg-white rounded-3xl border border-slate-100 p-10 text-center">
                  <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium text-sm">لا توجد سجلات طبية مدونة لهذا المريض بعد</p>
                </div>
              )}

              {!historyLoading && history.map((rec, idx) => (
                <div key={rec.record_id} className="bg-white rounded-3xl border border-slate-100 overflow-hidden">
                  {/* Record header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">{fmtDateTime(rec.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {idx === 0 && (
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> الأحدث
                        </span>
                      )}
                      {rec.booking_date && (
                        <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-xl">
                          <Clock className="w-3 h-3" />
                          {fmtDate(rec.booking_date)}{rec.start_time ? ` · ${fmtTime(rec.start_time)}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Diagnosis */}
                    <div className="flex items-start gap-3 justify-end">
                      <div className="text-right flex-1">
                        <p className="text-xs font-black text-slate-400 mb-1">التشخيص</p>
                        <p className="font-bold text-slate-900">{rec.diagnosis}</p>
                      </div>
                      <div className="w-9 h-9 rounded-2xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="w-4 h-4 text-rose-500" />
                      </div>
                    </div>

                    {rec.prescription && (
                      <>
                        <div className="h-px bg-slate-50" />
                        <div className="flex items-start gap-3 justify-end">
                          <div className="text-right flex-1">
                            <p className="text-xs font-black text-slate-400 mb-1">الوصفة الطبية</p>
                            <p className="text-slate-700 text-sm whitespace-pre-wrap">{rec.prescription}</p>
                          </div>
                          <div className="w-9 h-9 rounded-2xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                            <Pill className="w-4 h-4 text-sky-500" />
                          </div>
                        </div>
                      </>
                    )}

                    {rec.notes && (
                      <>
                        <div className="h-px bg-slate-50" />
                        <div className="flex items-start gap-3 justify-end">
                          <div className="text-right flex-1">
                            <p className="text-xs font-black text-slate-400 mb-1">ملاحظات سريرية</p>
                            <p className="text-slate-600 text-sm whitespace-pre-wrap">{rec.notes}</p>
                          </div>
                          <div className="w-9 h-9 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                            <FileText className="w-4 h-4 text-amber-500" />
                          </div>
                        </div>
                      </>
                    )}

                    {rec.next_visit && (
                      <div className="flex items-center gap-2 justify-end pt-1 border-t border-slate-50">
                        <p className="text-sm font-medium text-slate-500">
                          الزيارة القادمة: <strong className="text-emerald-700">{rec.next_visit}</strong>
                        </p>
                        <CalendarDays className="w-4 h-4 text-emerald-500" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
