import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { IRAQI_GOVERNORATES } from '@/lib/constants';
import {
  LayoutDashboard,
  Search,
  Calendar,
  FileText,
  Wallet,
  LogOut,
  User,
  Bell,
  Clock,
  MapPin,
  Users,
  DollarSign,
  Megaphone,
  Settings,
  UserPlus,
  Trophy,
  Activity,
  ChevronDown,
  Gift,
  Building2,
  MessageCircle
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import NotificationsPopover from '@/components/NotificationsPopover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from '@/lib/supabase';

export default function DashboardLayout() {
  const { user, logout, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const [showGovModal, setShowGovModal] = useState(false);
  const [selectedGov, setSelectedGov] = useState('');
  const [savingGov, setSavingGov] = useState(false);

  useEffect(() => {
    if (user && (user.role === 'PATIENT' || user.role === 'DOCTOR') && !user.governorate) {
      setShowGovModal(true);
    } else {
      setShowGovModal(false);
    }
  }, [user]);

  const handleSaveGov = async () => {
    if (!user || !selectedGov) return;
    setSavingGov(true);
    try {
      const { error } = await supabase.rpc('update_user_governorate', {
        p_user_id: user.id,
        p_governorate: selectedGov
      });
      if (error) throw error;
      
      setAuth({ ...user, governorate: selectedGov });
      setShowGovModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingGov(false);
    }
  };

  // Check upcoming bookings and send reminders for bookings due within 2 hours
  useEffect(() => {
    if (!user || !user.id || (user.role !== 'PATIENT' && user.role !== 'DOCTOR')) return;

    const checkUpcoming = async () => {
      try {
        const { data, error } = await supabase.rpc('get_user_upcoming_bookings', {
          p_user_id: user.id,
          p_role: user.role
        });
        if (error) throw error;
        if (!data || data.length === 0) return;

        const now = new Date();

        for (const b of data) {
          if (b.soon_notified) continue;

          // Parse booking date and time in local timezone
          const [year, month, day] = b.booking_date.split('-').map(Number);
          const [hour, minute] = b.start_time.split(':').map(Number);
          const bookingDateTime = new Date(year, month - 1, day, hour, minute);

          const diffMs = bookingDateTime.getTime() - now.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);

          // If booking is today and starts within the next 2 hours (and not older than 10 mins)
          if (diffHours > -0.15 && diffHours <= 2) {
            // Send notification to patient
            const patientTitle = 'تذكير بالموعد القريب';
            const patientMsg = `تذكير: موعدك مع الطبيب ${b.doctor_name} قريباً اليوم الساعة ${b.start_time.substring(0, 5)}. يرجى الحضور في الموعد.`;
            
            await supabase.rpc('create_notification', {
              p_user_id: b.patient_id,
              p_title: patientTitle,
              p_message: patientMsg,
              p_type: 'upcoming',
              p_notify_admin: true
            });

            // Send notification to doctor
            const doctorTitle = 'تذكير بموعد قريب';
            const doctorMsg = `تذكير: لديك موعد مع المريض ${b.patient_name} قريباً اليوم الساعة ${b.start_time.substring(0, 5)}.`;
            
            await supabase.rpc('create_notification', {
              p_user_id: b.doctor_id,
              p_title: doctorTitle,
              p_message: doctorMsg,
              p_type: 'upcoming',
              p_notify_admin: true
            });

            // Mark booking as soon_notified in DB
            await supabase.rpc('mark_booking_soon_notified', { p_booking_id: b.id });
          }
        }
      } catch (err) {
        console.error('Error scanning upcoming bookings:', err);
      }
    };

    checkUpcoming();
    const interval = setInterval(checkUpcoming, 120000); // 2 minutes
    return () => clearInterval(interval);
  }, [user]);

  const patientNav = [
    { name: 'الرئيسية', href: '/', icon: LayoutDashboard },
    { name: 'المجمعات الطبية', href: '/complexes', icon: Building2 },
    { name: 'أطباء', href: '/doctors', icon: Search },
    { name: 'حجوزاتي', href: '/bookings', icon: Calendar },
    { name: 'سجلاتي', href: '/medical-records', icon: FileText },
    { name: 'المحفظة', href: '/wallet', icon: Wallet },
    { name: 'الرسائل', href: '/messages', icon: MessageCircle },
  ];

  const doctorNav = [
    { name: 'لوحة التحكم', href: '/doctor', icon: LayoutDashboard },
    { name: 'الجدول', href: '/doctor/schedule', icon: Clock },
    { name: 'عياداتي', href: '/doctor/clinics', icon: MapPin },
    { name: 'الحجوزات', href: '/doctor/bookings', icon: Calendar },
    { name: 'المرضى', href: '/doctor/patients', icon: Users },
    { name: 'الرسائل', href: '/doctor/messages', icon: MessageCircle },
    { name: 'ملفي', href: '/doctor/profile', icon: User },
  ];

  const adminNav = [
    { name: 'لوحة التحكم', href: '/admin', icon: LayoutDashboard },
    { name: 'الأطباء', href: '/admin/doctors', icon: Activity },
    { name: 'المرضى', href: '/admin/patients', icon: Users },
    { name: 'المجمعات الطبية', href: '/admin/complexes', icon: Building2 },
    { name: 'الحجوزات', href: '/admin/bookings', icon: Calendar },
    { name: 'المالية', href: '/admin/financials', icon: DollarSign },
    { name: 'المروجون', href: '/admin/promoters', icon: UserPlus },
    { name: 'التنبيهات', href: '/admin/notifications', icon: Megaphone },
    { name: 'أكواد الشحن', href: '/admin/redeem-codes', icon: Gift },
    { name: 'الإعدادات', href: '/admin/settings', icon: Settings },
  ];

  const promoterNav = [
    { name: 'لوحة التحكم', href: '/promoter', icon: LayoutDashboard },
    { name: 'إضافة طبيب', href: '/promoter/add-doctor', icon: UserPlus },
    { name: 'أطبائي', href: '/promoter/my-doctors', icon: Users },
    { name: 'المكافآت', href: '/promoter/rewards', icon: Trophy },
  ];

  const navItems =
    user?.role === 'PATIENT' ? patientNav :
    user?.role === 'DOCTOR' ? doctorNav :
    user?.role === 'ADMIN' ? adminNav :
    user?.role === 'PROMOTER' ? promoterNav : patientNav;

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    logout();
    navigate('/login');
  };

  const roleLabel = user?.role === 'ADMIN' ? 'مدير النظام' : user?.role === 'DOCTOR' ? 'طبيب' : user?.role === 'PROMOTER' ? 'مروج' : 'مريض';

  return (
    <div className="min-h-screen bg-[#F0F4FF]" dir="rtl">
      {/* ── DESKTOP LAYOUT ── */}
      <div className="hidden md:flex h-screen overflow-hidden">

        {/* Floating Sidebar */}
        <div className="w-[72px] xl:w-64 flex-shrink-0 p-4 flex flex-col gap-2">
          <aside className="flex-1 flex flex-col rounded-3xl overflow-hidden bg-white shadow-[0_4px_40px_rgba(0,0,0,0.06)] border border-slate-100">
            {/* Logo */}
            <div className="p-5 xl:p-6 border-b border-slate-50 flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                  <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm0 12a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm6-6a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zM6 8a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" />
                </svg>
              </div>
              <span className="text-slate-900 font-black text-lg hidden xl:block tracking-tight">حجوزاتي</span>
            </div>

            {/* Nav Links */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-2xl font-bold text-sm transition-all duration-200 group relative ${
                      isActive
                        ? 'text-white shadow-lg'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                    style={isActive ? { background: 'linear-gradient(135deg, #3730a3, #4f46e5)', boxShadow: '0 4px 15px rgba(79,70,229,0.35)' } : {}}
                  >
                    <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                    <span className="hidden xl:block">{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User Footer */}
            <div className="p-3 border-t border-slate-50">
              {user ? (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 p-2 rounded-2xl hover:bg-red-50 text-slate-800 hover:text-red-600 transition-all group"
                  title="تسجيل الخروج"
                >
                  <Avatar className="w-8 h-8 flex-shrink-0">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="text-xs font-black text-white" style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-right hidden xl:block min-w-0">
                    <p className="text-sm font-black truncate leading-none group-hover:text-red-600">{user.name}</p>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 justify-start">
                      <span>{roleLabel}</span>
                      <span className="text-[10px] text-slate-300 group-hover:text-red-400">·</span>
                      <span className="text-[10px] text-red-500 font-bold group-hover:text-red-600">خروج</span>
                    </p>
                  </div>
                  <LogOut className="w-4 h-4 text-slate-400 group-hover:text-red-500 hidden xl:block flex-shrink-0" />
                </button>
              ) : (
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 p-2.5 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                >
                  <User className="w-4 h-4" />
                  <span className="hidden xl:block">تسجيل الدخول</span>
                </Link>
              )}
            </div>
          </aside>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden py-4 pl-4">
          {/* Top Bar */}
          <header className="flex-shrink-0 flex items-center justify-between mb-4 px-2">
            <div>
              {user ? (
                <>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">أهلاً بك مجدداً</p>
                  <h1 className="text-xl font-black text-slate-800">{user.name}</h1>
                </>
              ) : (
                <h1 className="text-xl font-black text-slate-800">مرحباً بك في حجوزاتي</h1>
              )}
            </div>
            <div className="flex items-center gap-3">
              <NotificationsPopover />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto pr-2">
            <div className="max-w-[1400px] mx-auto px-2 pb-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* ── MOBILE LAYOUT ── */}
      <div className="md:hidden flex flex-col min-h-screen">
        {/* Mobile Top Bar */}
        <header className="bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild nativeButton={false}>
                  <Avatar className="w-9 h-9 cursor-pointer border-2 border-slate-100">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="text-xs font-black text-white" style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-60 rounded-2xl p-2 text-right border border-slate-100 shadow-xl">
                  <DropdownMenuLabel className="px-3 py-2">
                    <p className="font-black text-slate-900">{user.name}</p>
                    <p className="text-xs text-slate-400 font-normal mt-0.5">{roleLabel}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-50" />
                  <DropdownMenuItem className="rounded-xl gap-2 cursor-pointer justify-end font-bold" onClick={() => navigate('/profile')}>
                    الملف الشخصي <User className="w-4 h-4" />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-50" />
                  <DropdownMenuItem className="rounded-xl gap-2 text-red-500 cursor-pointer justify-end font-bold" onClick={handleLogout}>
                    تسجيل الخروج <LogOut className="w-4 h-4" />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link to="/login">
                <button className="text-sm font-bold text-white py-2 px-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                  دخول
                </button>
              </Link>
            )}
            <NotificationsPopover />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                <path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm0 12a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zm6-6a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4zM6 8a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" />
              </svg>
            </div>
            <span className="font-black text-slate-900 text-lg">حجوزاتي</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 pb-32">
          <Outlet />
        </main>

        {/* Floating Bottom Nav — scrollable so all items show */}
        <nav className="fixed bottom-4 right-4 left-4 z-50">
          <div
            className="flex items-center py-3 px-3 rounded-[2rem] bg-white/95 backdrop-blur-xl border border-slate-100 overflow-x-auto gap-1 no-scrollbar"
            style={{
              boxShadow: '0 8px 40px rgba(79,70,229,0.15)',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {navItems.map((item) => {
              const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex flex-col items-center gap-1 flex-shrink-0 px-3 py-1 rounded-2xl transition-all duration-200 ${isActive ? 'bg-indigo-50' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${isActive ? 'text-white' : 'text-slate-400'}`}
                    style={isActive ? { background: 'linear-gradient(135deg, #3730a3, #4f46e5)' } : {}}>
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[9px] font-black whitespace-nowrap transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}>
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      {/* Governorate Selection Modal Overlay */}
      {showGovModal && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-[32px] w-full max-w-lg p-8 shadow-2xl flex flex-col space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <MapPin className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mt-2">اختر محافظتك</h2>
              <p className="text-slate-500 text-sm font-medium">
                يرجى اختيار المحافظة لتخصيص تجربتك وعرض العيادات والمجمعات الطبية الأقرب إليك.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {IRAQI_GOVERNORATES.map((gov) => (
                <button
                  key={gov}
                  onClick={() => setSelectedGov(gov)}
                  className={`h-12 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center ${
                    selectedGov === gov
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-slate-300 hover:border-slate-400 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {gov}
                </button>
              ))}
            </div>

            <button
              onClick={handleSaveGov}
              disabled={!selectedGov || savingGov}
              className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {savingGov ? 'جاري الحفظ...' : 'تأكيد وحفظ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
