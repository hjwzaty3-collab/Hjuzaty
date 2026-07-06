import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex" dir="rtl">
      {/* Right Form Panel — Rendered first in JSX so it appears on the right under RTL */}
      <div className="flex-1 bg-white flex items-center justify-center p-8 lg:p-16 overflow-y-auto">
        <div className="w-full max-w-md">
          {/* Mobile logo only */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm0 12a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm6-6a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zM6 8a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" />
              </svg>
            </div>
            <span className="text-slate-800 font-bold text-xl">حجوزاتي</span>
          </div>
          <Outlet />
        </div>
      </div>

      {/* Left Visual Panel — Rendered second in JSX so it appears on the left under RTL */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden flex-col justify-between p-12 text-right"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3730a3 30%, #4f46e5 60%, #7c3aed 100%)' }}>
        
        {/* Floating blob shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #60a5fa 0%, transparent 70%)' }} />
          <div className="absolute top-1/2 -left-20 w-[350px] h-[350px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />
          <div className="absolute -bottom-40 left-1/3 w-[450px] h-[450px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, #818cf8 0%, transparent 70%)' }} />
          {/* Grid dots pattern */}
          <div className="absolute inset-0 opacity-[0.06]"
            style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }} />
        </div>

        {/* Logo at top */}
        <div className="relative z-10 flex items-center gap-3 justify-start">
          <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/25 shadow-lg">
            <svg viewBox="0 0 24 24" className="w-7 h-7 text-white" fill="currentColor">
              <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm0 12a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm6-6a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zM6 8a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" />
            </svg>
          </div>
          <span className="text-white font-bold text-xl tracking-wide">حجوزاتي</span>
        </div>

        {/* Center content */}
        <div className="relative z-10 flex flex-col gap-8 text-right">
          {/* Stats floating cards */}
          <div className="flex flex-col gap-4">
            <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-3xl p-6 flex items-center gap-4 justify-start">
              <div className="w-12 h-12 bg-blue-400/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="text-white text-right">
                <div className="text-2xl font-black font-mono">+5,200</div>
                <div className="text-white/70 text-sm font-medium">طبيب موثق</div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-3xl p-6 flex items-center gap-4 mr-8 justify-start">
              <div className="w-12 h-12 bg-purple-400/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-white text-right">
                <div className="text-2xl font-black font-mono">+120K</div>
                <div className="text-white/70 text-sm font-medium">حجز ناجح</div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-3xl p-6 flex items-center gap-4 justify-start">
              <div className="w-12 h-12 bg-indigo-400/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <div className="text-white text-right">
                <div className="text-2xl font-black font-mono">4.9 ★</div>
                <div className="text-white/70 text-sm font-medium">متوسط التقييم</div>
              </div>
            </div>
          </div>

          <div className="space-y-3 text-right">
            <h1 className="text-4xl font-black text-white leading-tight">
              رعايتك الصحية<br/>في متناول يدك
            </h1>
            <p className="text-white/70 text-lg font-medium leading-relaxed">
              احجز مواعيدك مع أفضل الأطباء في ثوانٍ
            </p>
          </div>
        </div>

        {/* Bottom quote */}
        <div className="relative z-10 text-right">
          <p className="text-white/50 text-sm font-medium">
            © 2025 حجوزاتي · منصة الرعاية الصحية الذكية
          </p>
        </div>
      </div>
    </div>
  );
}

