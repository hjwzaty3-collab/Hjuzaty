import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Banknote, ShieldCheck, ArrowRight, CheckCircle2, Loader2,
  Calendar, Clock, MapPin, Wallet, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { sendNotification } from '@/services/notificationService';

const PAYMENT_METHODS = [
  { id: 'wallet',   label: 'المحفظة الداخلية', desc: 'الدفع من رصيد محفظتي', color: 'from-indigo-500 to-violet-600' },
  { id: 'zaincash', label: 'زين كاش',           desc: 'الدفع عبر المحفظة الرقمية', color: 'from-emerald-400 to-teal-500' },
  { id: 'cash',     label: 'كاش في العيادة',    desc: 'الدفع نقداً عند الحضور',    color: 'from-amber-400 to-orange-500' },
];

export default function PaymentPage() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const bookingData = location.state;
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);

  const [method, setMethod] = useState('wallet');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [appointmentId, setAppointmentId] = useState('');
  const [platformFee, setPlatformFee] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  const doctorFee   = bookingData?.price || 0;
  const totalAmount = doctorFee + platformFee;

  useEffect(() => {
    (async () => {
      setLoadingData(true);
      // Fetch platform fee
      const { data: fee } = await supabase.rpc('get_platform_fee');
      if (fee !== null) setPlatformFee(Number(fee));

      // Fetch wallet balance (anon-safe RPC)
      if (user) {
        const { data: bal } = await supabase.rpc('get_wallet_balance', { p_user_id: user.id });
        if (bal !== null) setWalletBalance(Number(bal));
      }
      setLoadingData(false);
    })();
  }, [user]);

  if (!bookingData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-4" dir="rtl">
        <p className="text-red-500 font-bold">لم يتم العثور على بيانات الحجز</p>
        <button onClick={() => navigate('/doctors')}
          className="text-sm font-bold text-white px-5 py-2.5 rounded-2xl"
          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
          العودة للأطباء
        </button>
      </div>
    );
  }

  const handlePayment = async () => {
    if (!user) { toast.error('يرجى تسجيل الدخول أولاً'); return; }
    setProcessing(true);
    try {
      let bookingId = '';

      if (method === 'wallet') {
        // Wallet payment: use process_booking_payment RPC
        if (walletBalance < totalAmount) {
          toast.error(`رصيدك غير كافٍ. رصيدك ${walletBalance.toLocaleString()} د.ع والمطلوب ${totalAmount.toLocaleString()} د.ع`);
          setProcessing(false);
          return;
        }

        const { data, error } = await supabase.rpc('process_booking_payment', {
          p_patient_id:   user.id,
          p_doctor_id:    bookingData.doctorId,
          p_amount:       doctorFee,
          p_platform_fee: platformFee,
          p_booking_date: bookingData.date,
          p_start_time:   bookingData.time,
          p_clinic_id:    bookingData.clinicId || null,
          p_notes:        `دفع بالمحفظة`,
        });

        if (error) throw new Error(error.message);
        const result = data as any;
        if (!result.success) {
          if (result.error === 'INSUFFICIENT_BALANCE') {
            toast.error(`رصيدك غير كافٍ. المطلوب ${Number(result.required).toLocaleString()} د.ع`);
          } else {
            toast.error('فشلت عملية الدفع');
          }
          setProcessing(false);
          return;
        }

        bookingId = result.booking_id;
        // Update local balance
        const newBalance = walletBalance - totalAmount;
        setWalletBalance(newBalance);
        if (user) setAuth({ ...user, wallet_balance: newBalance });

      } else {
        // Cash / ZainCash: just create booking (no wallet deduction)
        await new Promise(r => setTimeout(r, 1500));
        const { data, error } = await supabase.from('bookings').insert([{
          patient_id:   user.id,
          doctor_id:    bookingData.doctorId,
          booking_date: bookingData.date,
          start_time:   bookingData.time,
          end_time:     bookingData.time,
          price:        doctorFee,
          platform_fee: method === 'zaincash' ? platformFee : 0,
          status:       'pending',
          notes:        `دفع عبر ${method === 'zaincash' ? 'زين كاش' : 'كاش في العيادة'}`,
          clinic_id:    bookingData.clinicId || null,
        }]).select().single();

        if (error) throw error;
        bookingId = data.id;

        // Record patient transaction
        try {
          await supabase.rpc('get_my_transactions', { p_user_id: user.id }); // warm cache
          await supabase.from('transactions').insert([{
            user_id: user.id, amount: -totalAmount, type: 'payment',
            description: `حجز موعد - ${bookingData.doctorName}`, status: 'Completed',
          }]);
        } catch (_) {}
      }

      // Notify doctor & admin
      try {
        const notifyMsg = `المريض ${user.name} حجز موعداً في ${bookingData.date} الساعة ${bookingData.time}`;
        await sendNotification(bookingData.doctorId, 'حجز جديد', notifyMsg, 'INFO', true);
      } catch (_) {}

      setAppointmentId(bookingId);
      setSuccess(true);
      toast.success('تمت عملية الحجز بنجاح!');
    } catch (e: any) {
      toast.error('حدث خطأ: ' + (e.message || 'حاول مجدداً'));
    } finally {
      setProcessing(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-6" dir="rtl">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto"
          style={{ background: 'linear-gradient(135deg, #34d399, #10b981)' }}>
          <CheckCircle2 className="w-12 h-12 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900">تم تأكيد الحجز! 🎉</h1>
          <p className="text-slate-500 font-medium mt-1.5">تم حجز موعدك مع {bookingData.doctorName} بنجاح</p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 p-6 space-y-3 text-right shadow-sm">
          {[
            { label: 'التاريخ', value: bookingData.date },
            { label: 'الوقت', value: bookingData.time },
            { label: 'المبلغ المدفوع', value: `${totalAmount.toLocaleString()} د.ع` },
            { label: 'رقم الحجز', value: `#${appointmentId.substring(0, 8).toUpperCase()}` },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="font-black text-slate-900 text-sm" dir="ltr">{row.value}</span>
              <span className="text-xs font-bold text-slate-400">{row.label}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={() => navigate('/bookings')}
            className="w-full py-3.5 rounded-2xl font-bold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
            عرض حجوزاتي
          </button>
          <button onClick={() => navigate('/')}
            className="w-full py-3.5 rounded-2xl font-bold border-2 border-slate-100 text-slate-600 hover:bg-slate-50 transition-all">
            الرئيسية
          </button>
        </div>
      </div>
    );
  }

  const insufficientBalance = method === 'wallet' && walletBalance < totalAmount;

  // ── Payment screen ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto pb-10 space-y-5" dir="rtl">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowRight className="w-4 h-4" />رجوع
      </button>
      <h1 className="text-2xl font-black text-slate-900 text-right">إتمام الحجز</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Payment methods */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="font-black text-slate-900 text-right">اختر طريقة الدفع</h2>
            <div className="space-y-3">
              {PAYMENT_METHODS.map(m => (
                <button key={m.id} onClick={() => setMethod(m.id)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${method === m.id ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${method === m.id ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                    {/* Balance badge for wallet */}
                    {m.id === 'wallet' && !loadingData && (
                      <span className={`text-xs font-black px-2 py-0.5 rounded-xl ${walletBalance >= totalAmount ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                        {walletBalance.toLocaleString()} د.ع
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-black text-slate-900 text-sm">{m.label}</p>
                      <p className="text-xs text-slate-400 font-medium">{m.desc}</p>
                    </div>
                    <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${m.color} flex items-center justify-center flex-shrink-0`}>
                      {m.id === 'wallet' ? <Wallet className="w-5 h-5 text-white" /> : <Banknote className="w-5 h-5 text-white" />}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Insufficient balance warning */}
          {insufficientBalance && (
            <div className="bg-red-50 border-2 border-red-100 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="text-right">
                <p className="text-sm font-black text-red-700">رصيدك غير كافٍ</p>
                <p className="text-xs text-red-500 mt-0.5">
                  رصيدك الحالي {walletBalance.toLocaleString()} د.ع. تحتاج {(totalAmount - walletBalance).toLocaleString()} د.ع إضافية.
                </p>
                <button onClick={() => navigate('/wallet')}
                  className="mt-2 text-xs font-black text-red-600 underline">
                  اذهب لشحن المحفظة ←
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl text-right">
            <p className="text-sm font-medium text-indigo-700 flex-1">بيانات دفعك مشفرة وآمنة تماماً.</p>
            <ShieldCheck className="w-5 h-5 text-indigo-600 flex-shrink-0" />
          </div>
        </div>

        {/* Order summary */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
            <h2 className="font-black text-slate-900 text-right">ملخص الحجز</h2>

            <div className="flex items-center gap-3 p-4 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #ede9fe, #e0e7ff)' }}>
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-base"
                style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                {(bookingData.doctorName || 'د').charAt(0)}
              </div>
              <div className="text-right flex-1">
                <p className="font-black text-slate-900 text-sm">{bookingData.doctorName}</p>
                <p className="text-xs text-indigo-600 font-bold">{bookingData.specialization}</p>
              </div>
            </div>

            <div className="space-y-2.5">
              {[
                { icon: Calendar, label: bookingData.date },
                { icon: Clock, label: bookingData.time },
                { icon: MapPin, label: bookingData.clinic || 'العيادة' },
              ].filter(r => r.label).map((row, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-600 font-medium justify-end">
                  <span>{row.label}</span>
                  <row.icon className="w-4 h-4 text-slate-400" />
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="border-t border-slate-50 pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-black text-slate-900">{doctorFee.toLocaleString()} د.ع</span>
                <span className="text-slate-400 font-bold">رسوم الكشفية</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-black text-slate-900">{platformFee.toLocaleString()} د.ع</span>
                <span className="text-slate-400 font-bold">رسوم الخدمة</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xl font-black text-indigo-600">{totalAmount.toLocaleString()} د.ع</span>
                <span className="font-black text-slate-900">الإجمالي</span>
              </div>
            </div>

            <button onClick={handlePayment}
              disabled={processing || loadingData || insufficientBalance}
              className="w-full py-4 rounded-2xl font-black text-white disabled:opacity-60 hover:opacity-90 transition-all flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
              {processing
                ? <><Loader2 className="w-5 h-5 animate-spin" />جاري المعالجة...</>
                : `ادفع ${totalAmount.toLocaleString()} د.ع`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
