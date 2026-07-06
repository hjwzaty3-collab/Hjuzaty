import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { ArrowRight, ShieldCheck, RefreshCw, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function VerifyCodePage() {
  const navigate = useNavigate();
  const { pendingPhone, pendingUser, setAuth } = useAuthStore();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Redirect if no pending phone
  if (!pendingPhone) {
    return <Navigate to="/login" replace />;
  }

  const handleVerify = async () => {
    if (code.length !== 4) return;
    
    setIsLoading(true);
    try {
      // 1. Call verify_otp_code RPC in the database
      const { data: isValid, error: verifyErr } = await supabase.rpc('verify_otp_code', {
        p_phone: pendingPhone,
        p_code: code
      });
      
      if (verifyErr) throw verifyErr;

      // Allow demo bypass
      const isDemoBypass = (pendingPhone.includes('1234567') || pendingPhone.includes('9998888') || pendingPhone.includes('+9647850086597')) && (code === '1234' || code === '123456');

      if (isValid || isDemoBypass) {
        if (pendingUser) {
          setAuth(pendingUser);
          toast.success(`أهلاً بك مجدداً، ${pendingUser.name} 🎉`);
          navigate('/');
        } else {
          toast.error('بيانات الحساب غير متوفرة');
        }
      } else {
        toast.error('رمز التحقق غير صحيح أو انتهت صلاحيته');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء التحقق من الرمز');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
      const { error: otpErr } = await supabase.rpc('save_otp_code', {
        p_phone: pendingPhone,
        p_code: otpCode
      });
      if (otpErr) throw otpErr;

      // Call Twilio REST API directly
      const sid = "AC3756ce73d982e6314e59ab33b990cdc0";
      const token = "e87f3e7a705690334d2d1c6115e79d89";
      const basicAuth = btoa(`${sid}:${token}`);
      
      let cleaned = pendingPhone.replace(/\D/g, '');
      if (cleaned.startsWith('07')) {
        cleaned = '964' + cleaned.substring(1);
      } else if (cleaned.startsWith('7') && cleaned.length === 9) {
        cleaned = '964' + cleaned;
      }
      
      const formattedPhone = `whatsapp:+${cleaned}`;
      
      const params = new URLSearchParams();
      params.append('To', formattedPhone);
      params.append('From', 'whatsapp:+14155238886');
      params.append('ContentSid', 'HXb5b62575e6e4ff6129ad7c8efe1f983e');
      const dateStr = new Date().toLocaleDateString('ar-IQ');
      const timeStr = new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
      params.append('ContentVariables', JSON.stringify({ "1": otpCode, "2": `${dateStr} ${timeStr}` }));
      params.append('Body', `رمز التحقق الثنائي الخاص بك للدخول إلى منصة حجوزاتي هو: ${otpCode}`);

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      if (res.ok) {
        toast.success('تم إعادة إرسال رمز التحقق بنجاح عبر واتساب 💬');
      } else {
        toast.warning(`فشل الإرسال التلقائي. رمز التحقق الجديد للتجربة هو: ${otpCode}`);
      }
    } catch (e) {
      toast.error('حدث خطأ أثناء إعادة إرسال الرمز');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="border border-white/20 shadow-2xl bg-white/90 backdrop-blur-xl rounded-[32px] overflow-hidden max-w-md w-full mx-auto" dir="rtl">
      {/* Top Graphic Accent Banner */}
      <div className="h-2.5 w-full bg-gradient-to-l from-indigo-500 via-purple-500 to-emerald-500" />
      
      <CardHeader className="space-y-4 text-center pt-8 pb-4 relative px-6">
        <div className="flex justify-between items-center mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl px-3 py-1.5 text-xs font-bold transition-all" 
            onClick={() => navigate('/login')}
          >
            <ArrowRight className="w-4 h-4" />رجوع
          </Button>
          
          <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-black tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            واتساب نشط
          </div>
        </div>

        {/* Security Shield Icon */}
        <div className="mx-auto w-16 h-16 rounded-[24px] bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center border-2 border-indigo-100/50 shadow-inner mb-2 animate-bounce-subtle">
          <ShieldCheck className="w-8 h-8 text-indigo-600" />
        </div>

        <CardTitle className="text-2xl font-black text-slate-900 leading-tight">رمز التحقق الثنائي</CardTitle>
        <CardDescription className="text-slate-500 text-sm px-4 leading-relaxed font-medium">
          أدخل رمز الأمان المكون من <span className="text-indigo-600 font-extrabold text-base">4 أرقام</span> المرسل إلى هاتف واتساب الخاص بك:
          <div className="mt-2 text-slate-800 font-extrabold text-sm tracking-wide bg-slate-50 border border-slate-100 py-1.5 px-3 rounded-xl inline-block" dir="ltr">
            {pendingPhone}
          </div>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col items-center space-y-8 px-8 pb-10">
        {/* OTP Input Slots */}
        <div dir="ltr" className="py-2">
          <InputOTP
            maxLength={4}
            value={code}
            onChange={(value) => setCode(value)}
            disabled={isLoading}
          >
            <InputOTPGroup className="gap-3.5 flex justify-center">
              {[0, 1, 2, 3].map((idx) => (
                <InputOTPSlot 
                  key={idx}
                  index={idx} 
                  className={`w-14 h-16 text-2xl font-extrabold text-slate-900 border-2 rounded-2xl bg-slate-50 transition-all duration-300 ${
                    code.length === idx 
                      ? 'border-indigo-500 ring-4 ring-indigo-50 bg-white scale-105 shadow-md shadow-indigo-100/50' 
                      : code.length > idx 
                        ? 'border-emerald-400 bg-white text-emerald-700 font-black' 
                        : 'border-slate-200 focus:border-indigo-500'
                  }`}
                />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {/* Submit Action Button */}
        <Button 
          className="w-full h-14 rounded-2xl font-bold text-white shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none transition-all duration-300 flex items-center justify-center gap-2 text-base" 
          onClick={handleVerify} 
          disabled={isLoading || code.length !== 4}
          style={{ background: 'linear-gradient(135deg,#3730a3,#4f46e5)' }}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              جاري التحقق...
            </>
          ) : (
            <>
              تحقق ومتابعة الدخول
            </>
          )}
        </Button>

        {/* Resend Helper Options */}
        <div className="pt-2 text-center w-full">
          <p className="text-xs text-slate-400 font-bold flex items-center justify-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            لم تستلم الرمز عبر واتساب؟
          </p>
          <button 
            onClick={handleResend}
            disabled={isResending || isLoading}
            className="mt-2 text-xs font-black text-indigo-600 hover:text-indigo-800 focus:outline-none disabled:opacity-40 transition-colors inline-flex items-center gap-1.5 border-b border-indigo-200 pb-0.5 hover:border-indigo-500"
          >
            {isResending ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                جاري إرسال رمز جديد...
              </>
            ) : (
              'إعادة إرسال الرمز الآن'
            )}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
