import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  UserPlus, 
  Users, 
  Trophy, 
  TrendingUp, 
  ArrowRight,
  Gift,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { User } from '@/types';
import { toast } from 'sonner';

export default function PromoterDashboardPage() {
  const navigate = useNavigate();
  const currentUser = useAuthStore(state => state.user);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser?.id) {
      fetchMyDoctors();
    }
  }, [currentUser?.id]);

  const fetchMyDoctors = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      // Fetch doctors from database
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'DOCTOR');

      if (error) {
        // Fallback search
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('users')
          .select('*');
        
        if (fallbackError) throw fallbackError;
        
        const filtered = fallbackData?.filter(doc => 
          (doc.role === 'DOCTOR' || doc.role === 'doctor') && 
          (doc.added_by_promoter_id === currentUser.id || doc.bio?.includes(`[PROM_ID:${currentUser.id}]`))
        );
        setDoctors(filtered || []);
      } else {
        const filtered = data?.filter(doc => 
          doc.added_by_promoter_id === currentUser.id || 
          doc.bio?.includes(`[PROM_ID:${currentUser.id}]`)
        );
        setDoctors(filtered || []);
      }
    } catch (error) {
      console.error('Error fetching doctors for promoter dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeCount = doctors.filter(d => d.status === 'active').length;
  const pendingCount = doctors.filter(d => d.status !== 'active').length;
  const totalRewards = activeCount * 250000;
  const pendingRewards = pendingCount * 250000;

  // Get first 3 doctors
  const recentDoctors = doctors.slice(0, 3);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-neutral-500 font-medium text-sm">جاري تحميل لوحة التحكم...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="order-2 md:order-1">
          <h1 className="text-3xl font-black text-slate-900">لوحة تحكم المروّج</h1>
          <p className="text-slate-550 text-sm font-medium mt-1">تتبع إحالاتك والأرباح التي حصلت عليها من إضافة الأطباء.</p>
        </div>
        <Button className="rounded-xl gap-2 font-bold order-1 md:order-2 self-end md:self-auto" onClick={() => navigate('/promoter/add-doctor')}>
          <UserPlus className="w-4 h-4" />
          إضافة طبيب جديد
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="text-right">
              <p className="text-sm text-neutral-500 font-bold">الأطباء المضافين</p>
              <h3 className="text-3xl font-black mt-1 text-slate-950">{doctors.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="text-right">
              <p className="text-sm text-neutral-500 font-bold">المكافآت المستلمة</p>
              <h3 className="text-2xl font-black mt-1 text-emerald-600">{totalRewards.toLocaleString()} د.ع</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Trophy className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-100 shadow-sm">
          <CardContent className="p-6 flex items-center justify-between gap-4">
            <div className="text-right">
              <p className="text-sm text-neutral-500 font-bold">المكافآت المعلقة</p>
              <h3 className="text-2xl font-black mt-1 text-amber-600">{pendingRewards.toLocaleString()} د.ع</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Doctors Added */}
        <Card className="lg:col-span-2 rounded-3xl border-slate-100 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <Button variant="ghost" size="sm" className="font-bold text-indigo-600 hover:text-indigo-700" onClick={() => navigate('/promoter/my-doctors')}>عرض الكل</Button>
            <div className="text-right">
              <CardTitle className="font-black text-lg">أطبائي المضافين حديثاً</CardTitle>
              <CardDescription className="text-slate-400 font-medium">أحدث الأطباء الذين قمت بتسجيلهم بنجاح.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentDoctors.length === 0 ? (
                <div className="py-12 text-center text-neutral-400 font-medium">
                  لم تقم بإضافة أي طبيب بعد. اضغط على زر الإضافة للبدء!
                </div>
              ) : (
                recentDoctors.map((doctor) => (
                  <div key={doctor.id} className="flex items-center justify-between p-4 rounded-2xl bg-neutral-50 hover:bg-neutral-100/70 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black">
                        {doctor.name?.charAt(0)}
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-800 text-sm">{doctor.name}</p>
                        <p className="text-xs text-neutral-500 mt-1">
                          {doctor.specialization || (doctor.bio?.includes('التخصص:') ? doctor.bio.split('\n').find(l => l.startsWith('التخصص:'))?.replace('التخصص:', '').split('[')[0].trim() : 'غير محدد')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${doctor.status === 'active' ? 'text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100' : 'text-amber-600 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100'}`}>
                        {doctor.status === 'active' ? 'نشط' : 'قيد المراجعة'}
                      </span>
                      <ArrowRight className="w-4 h-4 text-neutral-300 rotate-180" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Rewards / Milestones */}
        <div className="space-y-6">
          <Card className="rounded-3xl border-none shadow-sm bg-gradient-to-br from-indigo-800 to-indigo-900 text-white text-right">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 justify-end font-black text-lg">
                <span>الهدف القادم</span>
                <Gift className="w-5 h-5 text-indigo-200" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm opacity-90 leading-relaxed font-bold">أضف أطباء جدد لتصل إلى الهدف القادم وتحصل على مكافأة إضافية!</p>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>{doctors.length}/15 طبيب</span>
                  <span>التقدم</span>
                </div>
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${Math.min((doctors.length / 15) * 100, 100)}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-slate-100 shadow-sm text-right">
            <CardHeader>
              <CardTitle className="font-black text-base">كيف يعمل النظام؟</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">١</div>
                <p className="text-xs text-neutral-600 leading-relaxed font-semibold">قم بإضافة الطبيب وتعبئة معلومات العيادة من نموذج إضافة طبيب.</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">٢</div>
                <p className="text-xs text-neutral-600 leading-relaxed font-semibold">يقوم المشرف بمراجعة حساب الطبيب وتفعيله بعد التحقق من البيانات.</p>
              </div>
              <div className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5">٣</div>
                <p className="text-xs text-neutral-600 leading-relaxed font-semibold">تحصل على مكافأتك مباشرة فور تفعيل الحساب وقبول الطبيب لحجوزاته الأولى.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
