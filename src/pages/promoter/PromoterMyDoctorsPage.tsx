import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  UserPlus, 
  MoreVertical, 
  Filter, 
  Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase, handleSupabaseError } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';
import { User } from '@/types';
import { toast } from 'sonner';

export default function PromoterMyDoctorsPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [doctors, setDoctors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const currentUser = useAuthStore(state => state.user);
  useEffect(() => {
    if (!currentUser?.id) return;

    fetchMyDoctors();

    const channel = supabase
      .channel(`promoter-doctors-${currentUser.id}-${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users'
        },
        () => fetchMyDoctors()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id]);

  const fetchMyDoctors = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      console.log('Fetching doctors for promoter:', currentUser.id);
      
      // Attempt 1: Standard query
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'DOCTOR');

      if (error) {
        console.error('Initial fetch failed:', error);
        // Fallback for column missing or other errors
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('users')
          .select('*');
        
        if (fallbackError) throw fallbackError;
        
        const filtered = fallbackData?.filter(doc => 
          (doc.role === 'DOCTOR' || doc.role === 'doctor') && 
          (doc.added_by_promoter_id === currentUser.id || doc.bio?.includes(`[PROM_ID:${currentUser.id}]`))
        );
        console.log('Fallback filtered doctors:', filtered?.length);
        setDoctors(filtered || []);
      } else {
        // Filter by promoter client-side to be safe about column missing but not throwing error
        const filtered = data?.filter(doc => 
          doc.added_by_promoter_id === currentUser.id || 
          doc.bio?.includes(`[PROM_ID:${currentUser.id}]`)
        );
        console.log('Standard fetch + filtered doctors:', filtered?.length);
        setDoctors(filtered || []);
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
      toast.error('فشل تحميل قائمة الأطباء');
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter(d => {
    const searchLow = searchQuery.toLowerCase();
    const nameMatch = d.name?.toLowerCase().includes(searchLow);
    const specMatch = d.specialization?.toLowerCase().includes(searchLow);
    const bioMatch = d.bio?.startsWith('التخصص:') && d.bio.toLowerCase().includes(searchLow);
    return nameMatch || specMatch || bioMatch;
  });

  return (
    <div className="space-y-8 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">أطبائي</h1>
          <p className="text-neutral-500">قائمة الأطباء الذين قمت بإحالتهم إلى المنصة.</p>
        </div>
        <Button className="rounded-xl gap-2 font-bold" onClick={() => navigate('/dashboard/promoter/add-doctor')}>
          <UserPlus className="w-4 h-4" />
          إضافة طبيب جديد
        </Button>
      </div>

      <Card className="rounded-3xl border-none shadow-sm">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
            <Input 
              className="pr-10 rounded-xl text-right" 
              placeholder="البحث بالاسم أو التخصص..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="rounded-xl gap-2 font-bold">
            <Filter className="w-4 h-4" />
            تصفية
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-neutral-500">جاري تحميل الأطباء...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="pb-4 font-bold text-neutral-400 text-sm uppercase tracking-wider">الطبيب</th>
                    <th className="pb-4 font-bold text-neutral-400 text-sm uppercase tracking-wider">التخصص</th>
                    <th className="pb-4 font-bold text-neutral-400 text-sm uppercase tracking-wider">الحالة</th>
                    <th className="pb-4 font-bold text-neutral-400 text-sm uppercase tracking-wider text-center">الحجوزات</th>
                    <th className="pb-4 font-bold text-neutral-400 text-sm uppercase tracking-wider text-left pr-4">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {filteredDoctors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-neutral-400">
                        لم يتم العثور على أطباء مضافين من قبلك.
                      </td>
                    </tr>
                  ) : (
                    filteredDoctors.map((doctor) => (
                      <tr key={doctor.id} className="group hover:bg-neutral-50 transition-colors">
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                              {doctor.name?.charAt(0)}
                            </div>
                            <span className="font-bold text-neutral-900">{doctor.name}</span>
                          </div>
                        </td>
                        <td className="py-4 text-neutral-600 font-medium">
                          {doctor.specialization || (
                            doctor.bio?.includes('التخصص:') 
                              ? doctor.bio.split('\n').find(l => l.startsWith('التخصص:'))?.replace('التخصص:', '').split('[')[0].trim() 
                              : 'غير محدد'
                          )}
                        </td>
                        <td className="py-4">
                          <Badge variant={doctor.status === 'active' ? 'default' : 'secondary'} className="rounded-lg">
                            {doctor.status === 'active' ? 'نشط' : 'قيد المراجعة'}
                          </Badge>
                        </td>
                        <td className="py-4 text-center font-bold text-neutral-700">0</td>
                        <td className="py-4 text-left">
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

