import { useState, useEffect } from 'react';
import { Search, UserPlus, CheckCircle2, XCircle, Edit2, Trash2, Loader2, MapPin, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';
import { IRAQI_GOVERNORATES } from '@/lib/constants';

const FORM_FIELD = ({ label, value, onChange, type = 'text', dir = 'rtl', placeholder = '' }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">{label}</label>
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} dir={dir}
      className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
  </div>
);

const EMPTY_FORM = { name: '', email: '', phone: '', specialization: '', complex_id: '', governorate: '' };

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [panel, setPanel] = useState<'none' | 'add' | 'edit'>('none');
  const [selectedDoctor, setSelectedDoctor] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [complexes, setComplexes] = useState<any[]>([]);

  // Wallet Adjustment Modal State
  const [walletModal, setWalletModal] = useState<{ open: boolean; doctor: User | null; amount: string; desc: string }>({
    open: false,
    doctor: null,
    amount: '',
    desc: 'تعديل إداري للرصيد'
  });

  useEffect(() => {
    fetchDoctors();
    fetchComplexes();
    const ch = supabase.channel(`admin-doctors-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchDoctors)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchComplexes = async () => {
    try {
      const { data } = await supabase.from('medical_complexes').select('*').order('name');
      setComplexes(data || []);
    } catch (e) { console.error(e); }
  };

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('admin_get_all_users');
      if (error) { console.error('admin_get_all_users:', error.message); toast.error('فشل تحميل الأطباء'); return; }
      setDoctors(data?.filter((u: any) => u.role === 'DOCTOR') || []);
    } catch (e) { toast.error('فشل تحميل الأطباء'); }
    finally { setLoading(false); }
  };

  const openEdit = (doctor: User) => {
    setSelectedDoctor(doctor);
    setForm({
      name: doctor.name || '',
      email: doctor.email || '',
      phone: doctor.phone || '',
      specialization: (doctor as any).specialization || '',
      complex_id: (doctor as any).complex_id || '',
      governorate: (doctor as any).governorate || ''
    });
    setPanel('edit');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const bioText = `التخصص: ${form.specialization}`;
      
      const { error } = await supabase.rpc('admin_upsert_doctor', {
        p_id: panel === 'edit' && selectedDoctor ? selectedDoctor.id : null,
        p_name: form.name,
        p_email: form.email,
        p_phone: form.phone,
        p_bio: bioText,
        p_complex_id: form.complex_id || null,
        p_governorate: form.governorate || null
      });

      if (error) throw error;

      if (panel === 'add') {
        toast.success('تم إضافة الطبيب ✓');
      } else {
        toast.success('تم تحديث البيانات ✓');
      }
      setPanel('none');
      setForm(EMPTY_FORM);
      fetchDoctors();
    } catch (err: any) {
      if (err.message?.includes('users_email_key')) toast.error('البريد مستخدم مسبقاً');
      else toast.error('فشل العملية: ' + err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطبيب وكل سجلاته وحجوزاته وجداوله نهائياً؟')) return;
    try {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: id });
      if (error) throw error;
      toast.success('تم حذف الطبيب وكافة بياناته');
      fetchDoctors();
    } catch (e: any) { toast.error('فشل الحذف: ' + e.message); }
  };

  const toggleStatus = async (doctor: User) => {
    const isActive = (doctor as any).status !== 'inactive';
    const newStatus = isActive ? 'inactive' : 'active';
    
    if (newStatus === 'inactive' && doctor.phone) {
      if (confirm(`هل تريد حظر رقم الهاتف ${doctor.phone} بالكامل أيضاً؟`)) {
        try {
          const reason = prompt('يرجى كتابة سبب الحظر:', 'مخالفة شروط الخدمة') || 'تعديل إداري';
          const { error } = await supabase.rpc('admin_block_phone_number', {
            p_phone: doctor.phone,
            p_reason: reason
          });
          if (error) throw error;
          toast.success('تم حظر رقم الهاتف وتعطيل الحساب');
          fetchDoctors();
          return;
        } catch (e: any) {
          toast.error('فشل حظر الرقم: ' + e.message);
          return;
        }
      }
    }
    
    try {
      if (newStatus === 'active' && doctor.phone) {
        await supabase.rpc('admin_unblock_phone_number', { p_phone: doctor.phone });
      }
      
      const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', doctor.id);
      if (error) throw error;
      toast.success(newStatus === 'active' ? 'تم تنشيط الطبيب' : 'تم إيقاف الطبيب');
      fetchDoctors();
    } catch (e: any) {
      toast.error('فشل تغيير الحالة: ' + e.message);
    }
  };

  const handleAdjustWallet = async () => {
    if (!walletModal.doctor || !walletModal.amount) return;
    const amountNum = Number(walletModal.amount);
    if (isNaN(amountNum)) { toast.error('يرجى إدخال مبلغ صالح'); return; }
    
    try {
      const { error } = await supabase.rpc('admin_adjust_wallet', {
        p_user_id: walletModal.doctor.id,
        p_amount: amountNum,
        p_description: walletModal.desc,
        p_type: amountNum >= 0 ? 'credit' : 'debit'
      });
      if (error) throw error;
      
      toast.success('تم تعديل رصيد المحفظة بنجاح ✓');
      setWalletModal({ open: false, doctor: null, amount: '', desc: 'تعديل إداري للرصيد' });
      fetchDoctors();
    } catch (e: any) {
      toast.error('فشل تعديل الرصيد: ' + e.message);
    }
  };

  const filtered = doctors.filter(d =>
    d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d as any).specialization?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => { setForm(EMPTY_FORM); setPanel('add'); }}
          className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
          <UserPlus className="w-4 h-4" />
          إضافة طبيب جديد
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">إدارة الأطباء</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">{doctors.length} طبيب مسجل في المنصة</p>
        </div>
      </div>

      {/* Add/Edit Form Panel */}
      {panel !== 'none' && (
        <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-sm p-6 space-y-4 text-right">
          <h2 className="font-black text-slate-900">{panel === 'add' ? 'إضافة طبيب جديد' : 'تعديل بيانات الطبيب'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <FORM_FIELD label="الاسم الكامل" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} />
            <FORM_FIELD label="البريد الإلكتروني" value={form.email} dir="ltr" type="email" onChange={(e: any) => setForm({ ...form, email: e.target.value })} />
            <FORM_FIELD label="رقم الهاتف" value={form.phone} dir="ltr" onChange={(e: any) => setForm({ ...form, phone: e.target.value })} />
            <FORM_FIELD label="التخصص" value={form.specialization} placeholder="مثال: أمراض القلب" onChange={(e: any) => setForm({ ...form, specialization: e.target.value })} />
            
            <div className="space-y-1.5 text-right">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">المحافظة</label>
              <select
                value={form.governorate || ''}
                onChange={(e: any) => setForm({ ...form, governorate: e.target.value })}
                className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-right"
              >
                <option value="">اختر المحافظة...</option>
                {IRAQI_GOVERNORATES.map((gov) => (
                  <option key={gov} value={gov}>{gov}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 text-right">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">المجمع الطبي</label>
              <select
                value={form.complex_id || ''}
                onChange={(e: any) => setForm({ ...form, complex_id: e.target.value })}
                className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-right"
              >
                <option value="">عيادة مستقلة (لا ينتمي لمجمع)</option>
                {complexes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3 justify-start">
            <button onClick={() => setPanel('none')} className="px-5 py-2.5 rounded-2xl border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-50">إلغاء</button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 rounded-2xl font-bold text-sm text-white disabled:opacity-60 hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
              {saving ? 'جاري الحفظ...' : panel === 'add' ? 'إضافة الطبيب' : 'حفظ التغييرات'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="البحث بالاسم أو التخصص..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-11 pr-11 pl-4 rounded-2xl border-2 border-slate-100 bg-white text-slate-800 font-medium placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-400 transition-all" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">جاري تحميل الأطباء...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">الطبيب</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">التخصص</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">المحافظة</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">المجمع الطبي</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">المحفظة</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">الهاتف</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">الحالة</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="py-20 text-center text-slate-400 font-medium">لا يوجد أطباء مطابقون</td></tr>
                ) : filtered.map(doctor => {
                  const spec = (doctor as any).specialization ||
                    (doctor.bio?.includes('التخصص:') ? doctor.bio.split('\n').find(l => l.startsWith('التخصص:'))?.replace('التخصص:', '').split('[')[0].trim() : 'غير محدد');
                  const isActive = (doctor as any).status !== 'inactive';
                  const complexName = complexes.find(c => c.id === (doctor as any).complex_id)?.name || 'عيادة مستقلة';
                  const balance = doctor.wallet_balance || 0;
                  return (
                    <tr key={doctor.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                            {doctor.name?.charAt(0)}
                          </div>
                          <div className="text-right">
                            <p className="font-black text-slate-900 text-sm">{doctor.name}</p>
                            <p className="text-xs text-slate-400" dir="ltr">{doctor.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5">
                          {spec}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-700">
                        {doctor.governorate ? (
                          <span className="flex items-center gap-1 text-slate-600 text-xs">
                            <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                            {doctor.governorate}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs font-normal">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-500">
                        {complexName === 'عيادة مستقلة' ? (
                          <span className="text-slate-400 text-xs font-normal">عيادة مستقلة</span>
                        ) : (
                          <span className="text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-xl text-xs">{complexName}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-bold text-slate-700">{balance.toLocaleString()} د.ع</span>
                          <button onClick={() => setWalletModal({ open: true, doctor, amount: '', desc: 'تعديل إداري للرصيد' })}
                            className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors">
                            <Wallet className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-600" dir="ltr">{doctor.phone || '—'}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border ${isActive ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                          {isActive ? 'نشط' : 'معطل/محظور'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(doctor)} className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => toggleStatus(doctor)} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                            title={isActive ? "تعطيل/حظر الحساب" : "تنشيط الحساب"}>
                            {isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => handleDelete(doctor.id)} className="w-8 h-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Wallet Adjustment Modal */}
      {walletModal.open && walletModal.doctor && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden text-right">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <button onClick={() => setWalletModal({ open: false, doctor: null, amount: '', desc: 'تعديل إداري للرصيد' })}
                className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-black text-slate-900">تعديل رصيد المحفظة</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500">
                الطبيب: <strong className="text-slate-800">{walletModal.doctor.name}</strong>
              </p>
              <p className="text-xs text-slate-400">
                الرصيد الحالي: {(walletModal.doctor.wallet_balance || 0).toLocaleString()} د.ع
              </p>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">القيمة المراد إضافتها أو خصمها (د.ع)</label>
                <input type="number" placeholder="مثال: 25000 للإيداع، أو -15000 للخصم" value={walletModal.amount}
                  onChange={e => setWalletModal({ ...walletModal, amount: e.target.value })} dir="ltr"
                  className="w-full h-11 px-4 rounded-xl border-2 border-slate-100 text-slate-800 font-bold focus:outline-none focus:border-indigo-400 transition-all text-center" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">سبب التعديل</label>
                <input type="text" placeholder="مثال: تعويض مالي أو شحن رصيد" value={walletModal.desc}
                  onChange={e => setWalletModal({ ...walletModal, desc: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border-2 border-slate-100 text-slate-800 font-medium focus:outline-none focus:border-indigo-400 transition-all" />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 justify-start">
              <button onClick={() => setWalletModal({ open: false, doctor: null, amount: '', desc: 'تعديل إداري للرصيد' })}
                className="px-5 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 font-bold text-sm hover:bg-slate-50">إلغاء</button>
              <button onClick={handleAdjustWallet}
                className="px-6 py-2 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
                تطبيق التعديل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
