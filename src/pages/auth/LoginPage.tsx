import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { User } from '@/types';
import { supabase } from '@/lib/supabase';
import { Eye, EyeOff, Phone, User as UserIcon, Mail, Lock, ChevronLeft, UserPlus, LogIn, AlertTriangle } from 'lucide-react';

function cleanPhone(raw: string) {
  const clean = raw.replace(/\D/g, '');
  const formats = [raw.trim(), clean];
  if (clean.startsWith('0')) {
    const base = clean.substring(1);
    formats.push(base, `+964${base}`, `+966${base}`);
  } else {
    formats.push('0' + clean, `+964${clean}`, `+966${clean}`);
  }
  return [...new Set(formats)];
}

function Field({ id, label, type = 'text', placeholder, dir = 'ltr', icon: Icon, value, onChange, error, children }: any) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold text-slate-700">{label}</label>
      <div className="relative">
        <Icon className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input id={id} type={type} placeholder={placeholder} dir={dir} value={value} onChange={onChange}
          className={`w-full h-14 pr-11 pl-4 rounded-2xl border-2 bg-slate-50 text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:bg-white transition-all ${error ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-indigo-500'}`} />
        {children}
      </div>
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}

const sendTwilioOTP = async (phone: string, code: string): Promise<boolean> => {
  try {
    const sid = "AC3756ce73d982e6314e59ab33b990cdc0";
    const token = "e87f3e7a705690334d2d1c6115e79d89";
    const basicAuth = btoa(`${sid}:${token}`);
    
    // Clean and format phone for WhatsApp
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('07')) {
      cleaned = '964' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') && cleaned.length === 9) {
      cleaned = '964' + cleaned;
    }
    
    const formattedPhone = `whatsapp:+${cleaned}`;
    
    console.log('Sending Twilio OTP via WhatsApp to:', formattedPhone);
    
    const params = new URLSearchParams();
    params.append('To', formattedPhone);
    params.append('From', 'whatsapp:+14155238886');
    params.append('ContentSid', 'HXb5b62575e6e4ff6129ad7c8efe1f983e');
    const dateStr = new Date().toLocaleDateString('ar-IQ');
    const timeStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
    params.append('ContentVariables', JSON.stringify({ "1": code, "2": `${dateStr} ${timeStr}` }));
    params.append('Body', `رمز التحقق الثنائي الخاص بك للدخول إلى منصة حجوزاتي هو: ${code}`);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });
    
    if (!res.ok) {
      const err = await res.json();
      console.error('Twilio Response Error:', err);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return false;
  }
};

type Mode = 'login' | 'register';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const setPendingPhone = useAuthStore((s) => s.setPendingPhone);
  const setPendingUser = useAuthStore((s) => s.setPendingUser);
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);



  // login
  const [loginPhone, setLoginPhone] = useState('');
  const [loginErr, setLoginErr] = useState('');

  // register
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const regRole = 'PATIENT';
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [regSqlError, setRegSqlError] = useState(false);



  // ── Login ────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    if (loginPhone.trim().length < 10) { setLoginErr('يرجى إدخال رقم هاتف صالح'); return; }
    setLoading(true);
    try {
      // Use SECURITY DEFINER RPC to bypass RLS on the users table
      const { data: user, error } = await supabase.rpc('login_by_phone', {
        p_phone: loginPhone.trim(),
      });

      if (error) throw error;

      if (user) {
        let twoFactorEnabled = true;
        try {
          const { data: isEnabled, error: checkErr } = await supabase.rpc('is_two_factor_enabled');
          if (!checkErr) {
            twoFactorEnabled = !!isEnabled;
          }
        } catch (e) {
          console.warn('Could not fetch 2FA setting, defaulting to true:', e);
        }

        if (!twoFactorEnabled) {
          setAuth(user as User);
          toast.success(`أهلاً بك مجدداً، ${user.name} 🎉`);
          navigate('/');
          return;
        }

        const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
        const { error: otpErr } = await supabase.rpc('save_otp_code', {
          p_phone: user.phone,
          p_code: otpCode
        });
        if (otpErr) throw otpErr;

        const sent = await sendTwilioOTP(user.phone, otpCode);
        if (sent) {
          toast.success('تم إرسال رمز التحقق عبر واتساب 💬');
        } else {
          toast.warning(`فشل الإرسال التلقائي. رمز التحقق للتجربة هو: ${otpCode}`);
        }

        setPendingPhone(user.phone);
        setPendingUser(user as User);
        navigate('/verify-code');
        return;
      }

      // Demo mock fallback (for dev without DB)
      const c = loginPhone.replace(/\D/g, '');
      if (c.includes('1234567')) {
        const mockDoc = { id: 'doctor-1', email: 'doctor@demo.com', name: 'د. سارة أحمد (تجريبي)', role: 'DOCTOR', wallet_balance: 0, price: 150000, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        setPendingPhone(loginPhone.trim());
        setPendingUser(mockDoc as User);
        toast.info('الرمز التجريبي للدخول هو: 1234');
        navigate('/verify-code');
        return;
      }
      if (c.includes('9998888')) {
        const mockPat = { id: 'patient-1', email: 'patient@demo.com', name: 'أحمد محمد (تجريبي)', role: 'PATIENT', wallet_balance: 200000, price: 0, status: 'active', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        setPendingPhone(loginPhone.trim());
        setPendingUser(mockPat as User);
        toast.info('الرمز التجريبي للدخول هو: 1234');
        navigate('/verify-code');
        return;
      }

      setLoginErr('رقم الهاتف غير مسجل. يمكنك إنشاء حساب جديد.');
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('ACCOUNT_BLOCKED')) {
        setLoginErr('عذراً، هذا الرقم أو الحساب محظور من دخول النظام.');
      } else if (msg.includes('ACCOUNT_INACTIVE')) {
        setLoginErr('هذا الحساب معطل حالياً. يرجى مراجعة الإدارة.');
      } else if (msg.includes('login_by_phone') || msg.includes('function') || msg.includes('does not exist')) {
        setLoginErr('يلزم تشغيل سكريبت SQL في Supabase أولاً. راجع التعليمات.');
      } else {
        setLoginErr('حدث خطأ: ' + msg);
      }
    } finally { setLoading(false); }
  };


  // ── Register ─────────────────────────────────────────────
  // Uses a SECURITY DEFINER database function (register_user) that runs
  // as the DB owner, bypassing RLS entirely. No anon INSERT policy needed.
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSqlError(false);
    const errs: Record<string, string> = {};
    if (regName.trim().length < 2) errs.name = 'يرجى إدخال اسمك الكامل';
    if (regPhone.trim().length < 10) errs.phone = 'يرجى إدخال رقم هاتف صالح';
    if (Object.keys(errs).length) { setRegErrors(errs); return; }
    setRegErrors({});
    setLoading(true);
    try {
      // Call the SECURITY DEFINER RPC function — bypasses RLS completely
      const { data: newUser, error } = await supabase.rpc('register_user', {
        p_name:  regName.trim(),
        p_phone: regPhone.trim(),
        p_role:  regRole,
      });

      if (error) throw error;
      if (!newUser) throw new Error('لم يتم إرجاع بيانات المستخدم');

      setAuth(newUser as User);
      toast.success(`مرحباً بك، ${newUser.name} 🎉`);
      navigate('/');
    } catch (err: any) {
      const msg: string = err?.message || '';
      const hint: string = err?.hint || '';
      if (msg.includes('PHONE_BLOCKED')) {
        setRegErrors({ phone: 'عذراً، هذا الرقم محظور من إنشاء حساب جديد.' });
      } else if (msg.includes('PHONE_EXISTS') || hint.includes('PHONE_EXISTS')) {
        setRegErrors({ phone: 'رقم الهاتف مسجل مسبقاً — يمكنك تسجيل الدخول.' });
      } else if (msg.includes('register_user') || msg.includes('function') || msg.includes('does not exist')) {
        setRegSqlError(true);
      } else if (
        msg.includes('row-level security') || msg.includes('violates') ||
        msg.includes('security') || msg.includes('policy') ||
        err?.code === '42501'
      ) {
        setRegSqlError(true);
      } else {
        toast.error('فشل إنشاء الحساب: ' + msg);
        console.error('Registration error:', err);
      }
    } finally { setLoading(false); }
  };




  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/` } });
    if (error) { toast.error('فشل الدخول بجوجل'); setLoading(false); }
  };

  return (
    <div className="w-full" dir="rtl">

      {/* Header */}
      <div className="mb-8">
        {mode !== 'login' && (
          <button onClick={() => { setMode('login'); setRegSqlError(false); }}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" />رجوع
          </button>
        )}
        {mode === 'login' && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#3730a3,#4f46e5)' }}>
                <LogIn className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-black text-indigo-600 uppercase tracking-wider">تسجيل الدخول</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">مرحباً بعودتك 👋</h1>
            <p className="text-slate-500 text-sm mt-1">سجّل دخولك برقم هاتفك</p>
          </>
        )}
        {mode === 'register' && (
          <>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#059669,#0d9488)' }}>
                <UserPlus className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">حساب جديد</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900">إنشاء حساب 🎉</h1>
            <p className="text-slate-500 text-sm mt-1">مجاناً في أقل من دقيقة</p>
          </>
        )}

      </div>

      {/* ── LOGIN ── */}
      {mode === 'login' && (
        <form onSubmit={handleLogin} className="space-y-5">
          <Field id="lp" label="رقم الهاتف" type="tel" placeholder="+964 7XX XXX XXXX"
            icon={Phone} value={loginPhone} onChange={(e: any) => setLoginPhone(e.target.value)} error={loginErr} />

          <button type="submit" disabled={loading}
            className="w-full h-14 rounded-2xl font-bold text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all"
            style={{ background: 'linear-gradient(135deg,#3730a3,#4f46e5)' }}>
            {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
          </button>


          <div className="flex items-center justify-center gap-2 text-sm">
            <button type="button" onClick={() => setMode('register')} className="font-black text-indigo-600 hover:text-indigo-700">أنشئ حساباً الآن</button>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">ليس لديك حساب؟</span>
          </div>

        </form>
      )}

      {/* ── REGISTER ── */}
      {mode === 'register' && (
        <form onSubmit={handleRegister} className="space-y-5">

          {/* SQL error alert */}
          {regSqlError && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-right w-full">
                <p className="text-sm font-black text-amber-800 mb-1">يلزم تفعيل صلاحيات قاعدة البيانات</p>
                <p className="text-xs text-amber-700 mb-2">
                  شغّل هذا الكود في <strong>Supabase → SQL Editor</strong> مرة واحدة فقط:
                </p>
                <pre className="block bg-amber-100 text-amber-900 text-[10px] font-mono p-3 rounded-xl leading-relaxed select-all whitespace-pre-wrap">
{`CREATE OR REPLACE FUNCTION public.register_user(
  p_name text, p_phone text, p_role text DEFAULT 'PATIENT'
)
RETURNS json LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user users%ROWTYPE;
BEGIN
  IF p_role <> 'PATIENT' THEN
    RAISE EXCEPTION 'Only PATIENT accounts can be created via registration';
  END IF;
  SELECT * INTO v_user FROM users WHERE phone = p_phone LIMIT 1;
  IF FOUND THEN RAISE EXCEPTION 'PHONE_EXISTS'; END IF;
  INSERT INTO users (name, phone, role, status, wallet_balance, price)
  VALUES (p_name, p_phone, p_role::user_role, 'active', 0, 0)
  RETURNING * INTO v_user;
  RETURN row_to_json(v_user);
END; $$;

GRANT EXECUTE ON FUNCTION public.register_user TO anon;`}
                </pre>
                <p className="text-[10px] text-amber-600 mt-2 font-bold">ثم أعد المحاولة.</p>
              </div>
            </div>
          )}

          <Field id="rn" label="الاسم الكامل" type="text" placeholder="مثال: أحمد محمد علي" dir="rtl"
            icon={UserIcon} value={regName} onChange={(e: any) => setRegName(e.target.value)} error={regErrors.name} />

          <Field id="rp" label="رقم الهاتف" type="tel" placeholder="+964 7XX XXX XXXX"
            icon={Phone} value={regPhone} onChange={(e: any) => setRegPhone(e.target.value)} error={regErrors.phone} />

          <button type="submit" disabled={loading}
            className="w-full h-14 rounded-2xl font-bold text-white hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all"
            style={{ background: 'linear-gradient(135deg,#059669,#0d9488)' }}>
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب مجاناً'}
          </button>

          <div className="flex items-center justify-center gap-2 text-sm pt-1 border-t border-slate-200">
            <button type="button" onClick={() => setMode('login')} className="font-black text-indigo-600 hover:text-indigo-700">سجّل دخولك</button>
            <span className="text-slate-500">لديك حساب؟</span>
          </div>
        </form>
      )}


    </div>
  );
}
