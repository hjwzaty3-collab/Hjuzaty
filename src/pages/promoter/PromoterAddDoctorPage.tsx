import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, MapPin, ArrowRight, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase, handleSupabaseError } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

export default function PromoterAddDoctorPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const currentUser = useAuthStore(state => state.user);

  const [formData, setFormData] = useState({
    name: '',
    specialization: '',
    email: '',
    phone: '',
    clinic: '',
    address: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) {
      toast.error('لم يتم العثور على بيانات المروج. يرجى تسجيل الدخول مرة أخرى.');
      return;
    }
    setIsLoading(true);
    try {
      // 1. Create user
      const payload: any = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: 'DOCTOR',
        status: 'inactive',
        added_by_promoter_id: currentUser?.id,
        wallet_balance: 0,
        bio: `التخصص: ${formData.specialization}` // Fallback for specialization
      };

      // Try appending specialization and promoter_id if columns exist
      payload.specialization = formData.specialization;
      payload.added_by_promoter_id = currentUser.id;

      let { data: userData, error: userError } = await supabase
        .from('users')
        .insert([payload])
        .select()
        .single();

      if (userError) {
        // If it failed because of specialization OR promoter_id column OR UUID format issue
        const messageLow = userError.message.toLowerCase();
        const isSpecErr = messageLow.includes('specialization');
        const isPromoterErr = messageLow.includes('added_by_promoter_id') || 
                            messageLow.includes('uuid');
        
        if (isSpecErr || isPromoterErr) {
          console.warn('Handling insert error with fallback:', userError.message);
          if (isSpecErr) delete payload.specialization;
          if (isPromoterErr) {
             delete payload.added_by_promoter_id;
             // Store promoter ID in bio as fallback if column missing or UUID type mismatch
             if (!payload.bio.includes('[PROM_ID:')) {
               payload.bio = `${payload.bio}\n[PROM_ID:${currentUser.id}]`;
             }
          }
          
          const { data: retryData, error: retryError } = await supabase
            .from('users')
            .insert([payload])
            .select()
            .single();
          
          if (retryError) throw retryError;
          userData = retryData; // Update userData with retry result
        } else {
          throw userError;
        }
      }

      // 2. Add clinic if provided
      if (formData.clinic && userData) {
        await supabase.from('clinics').insert([{
          doctor_id: userData.id,
          name: formData.clinic,
          address: formData.address
        }]);
      }

      toast.success('تم إرسال طلب تسجيل الطبيب بنجاح');
      navigate('/dashboard/promoter/my-doctors');
    } catch (error: any) {
      console.error('Error adding doctor:', error);
      if (error.message?.includes('users_email_key') || error.message?.includes('duplicate key')) {
        toast.error('هذا البريد الإلكتروني مسجل مسبقاً لمستخدم آخر. يرجى استخدام بريد مختلف.');
      } else {
        toast.error('فشل إرسال الطلب: ' + (error.message || 'خطأ غير معروف'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl mx-auto pb-10 text-right" dir="rtl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">إضافة طبيب جديد</h1>
          <p className="text-neutral-500">قم بتسجيل طبيب جديد في منصة حجوزاتي.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="rounded-3xl border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-right">معلومات الطبيب</CardTitle>
            <CardDescription className="text-right">أدخل البيانات المهنية للطبيب الذي تشير إليه.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-right">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم الكامل</Label>
                <Input 
                  id="name" 
                  placeholder="اسم الطبيب" 
                  required 
                  className="rounded-xl h-12 text-right" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="specialization">التخصص</Label>
                <Input 
                  id="specialization" 
                  placeholder="مثال: طب قلب، طب أطفال..." 
                  required 
                  className="rounded-xl h-12 text-right" 
                  value={formData.specialization}
                  onChange={(e) => setFormData({...formData, specialization: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="doctor@example.com" 
                  required 
                  className="rounded-xl h-12 text-right" 
                  dir="ltr"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input 
                  id="phone" 
                  placeholder="+966..." 
                  required 
                  className="rounded-xl h-12 text-right" 
                  dir="ltr"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clinic">اسم العيادة / المستشفى</Label>
              <Input 
                id="clinic" 
                placeholder="أين يمارس الطبيب مهنته؟" 
                required 
                className="rounded-xl h-12 text-right" 
                value={formData.clinic}
                onChange={(e) => setFormData({...formData, clinic: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">عنوان العيادة</Label>
              <div className="relative">
                <MapPin className="absolute right-3 top-3 text-neutral-400 w-4 h-4" />
                <Textarea 
                  id="address" 
                  placeholder="عنوان الشارع بالكامل..." 
                  className="pr-10 rounded-xl min-h-[80px] text-right" 
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" className="w-full rounded-xl h-12 gap-2 font-bold" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> جاري التقديم...</>
                ) : (
                  <><UserPlus className="w-5 h-5" /> إرسال طلب التسجيل</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

