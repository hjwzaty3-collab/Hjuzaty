import { useState, useEffect } from 'react';
import { Search, UserPlus, Trophy, TrendingUp, Users, Star, Loader2, Edit2, Trash2, CheckCircle2, XCircle, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { User } from '@/types';

const EMPTY_FORM = { name: '', email: '', phone: '' };

const FORM_FIELD = ({ label, value, onChange, type = 'text', dir = 'rtl' }: any) => (
  <div className="space-y-1.5">
    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">{label}</label>
    <input type={type} value={value} onChange={onChange} dir={dir}
      className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
  </div>
);

export default function AdminPromotersPage() {
  const [promoters, setPromoters] = useState<(User & { doctorCount?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [panel, setPanel] = useState<'none' | 'add' | 'edit'>('none');
  const [selectedPromoter, setSelectedPromoter] = useState<User | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Wallet Modal State
  const [walletModal, setWalletModal] = useState<{ open: boolean; promoter: User | null; amount: string; desc: string }>({
    open: false,
    promoter: null,
    amount: '',
    desc: 'تعديل إداري للرصيد'
  });

  useEffect(() => {
    fetchPromoters();
    const ch = supabase.channel(`admin-promoters-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchPromoters)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const fetchPromoters = async () => {
    try {
      const { data: users, error } = await supabase.from('users').select('*').eq('role', 'PROMOTER').order('name');
      if (error) throw error;

      const withCounts = await Promise.all((users || []).map(async (p) => {
        const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('added_by_promoter_id', p.id);
        return { ...p, doctorCount: count || 0 };
      }));
      setPromoters(withCounts);
    } catch (e) { toast.error('فشل تحميل المروجين'); }
    finally { setLoading(false); }
  };

  const openEdit = (p: User) => {
    setSelectedPromoter(p);
    setForm({ name: p.name || '', email: p.email || '', phone: p.phone || '' });
    setPanel('edit');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (panel === 'add') {
        const { error } = await supabase.from('users').insert([{ ...form, role: 'PROMOTER', wallet_balance: 0 }]);
        if (error) throw error;
        toast.success('تم إضافة المروج ✓');
      } else if (panel === 'edit' && selectedPromoter) {
        const { error } = await supabase.from('users').update({ ...form, updated_at: new Date().toISOString() }).eq('id', selectedPromoter.id);
        if (error) throw error;
        toast.success('تم تحديث البيانات ✓');
      }
      setPanel('none');
      setForm(EMPTY_FORM);
      fetchPromoters();
    } catch (err: any) {
      toast.error(err.message?.includes('users_email_key') ? 'البريد مستخدم مسبقاً' : 'فشل العملية');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المروج وكل سجلاته نهائياً؟')) return;
    try {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: id });
      if (error) throw error;
      toast.success('تم حذف المروج وكافة بياناته');
      fetchPromoters();
    } catch (e: any) { toast.error('فشل الحذف: ' + e.message); }
  };

  const toggleStatus = async (p: User) => {
    const isActive = (p as any).status !== 'inactive';
    const newStatus = isActive ? 'inactive' : 'active';
    
    if (newStatus === 'inactive' && p.phone) {
      if (confirm(`هل تريد حظر رقم الهاتف ${p.phone} بالكامل أيضاً؟`)) {
        try {
          const reason = prompt('يرجى كتابة سبب الحظر:', 'مخالفة شروط الخدمة') || 'تعديل إداري';
          const { error } = await supabase.rpc('admin_block_phone_number', {
            p_phone: p.phone,
            p_reason: reason
          });
          if (error) throw error;
          toast.success('تم حظر رقم الهاتف وتعطيل الحساب');
          fetchPromoters();
          return;
        } catch (e: any) {
          toast.error('فشل حظر الرقم: ' + e.message);
          return;
        }
      }
    }
    
    try {
      if (newStatus === 'active' && p.phone) {
        await supabase.rpc('admin_unblock_phone_number', { p_phone: p.phone });
      }
      
      const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', p.id);
      if (error) throw error;
      toast.success(newStatus === 'active' ? 'تم التنشيط' : 'تم الإيقاف');
      fetchPromoters();
    } catch (e: any) {
      toast.error('فشل تغيير الحالة: ' + e.message);
    }
  };

  const handleAdjustWallet = async () => {
    if (!walletModal.promoter || !walletModal.amount) return;
    const amountNum = Number(walletModal.amount);
    if (isNaN(amountNum)) { toast.error('يرجى إدخال مبلغ صالح'); return; }
    
    try {
      const { error } = await supabase.rpc('admin_adjust_wallet', {
        p_user_id: walletModal.promoter.id,
        p_amount: amountNum,
        p_description: walletModal.desc,
        p_type: amountNum >= 0 ? 'credit' : 'debit'
      });
      if (error) throw error;
      
      toast.success('تم تعديل رصيد المحفظة بنجاح ✓');
      setWalletModal({ open: false, promoter: null, amount: '', desc: 'تعديل إداري للرصيد' });
      fetchPromoters();
    } catch (e: any) {
      toast.error('فشل تعديل الرصيد: ' + e.message);
    }
  };

  const totalDoctors = promoters.reduce((s, p) => s + (p.doctorCount || 0), 0);
  const totalWalletBalance = promoters.reduce((s, p) => s + (p.wallet_balance || 0), 0);

  const filtered = promoters.filter(p =>
    p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => { setForm(EMPTY_FORM); setPanel('add'); }}
          className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
          <UserPlus className="w-4 h-4" />
          إضافة مروج
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">إدارة المروجين</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">تتبع أداء المروجين وإدارة المكافآت</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'إجمالي المروجين', value: promoters.length, icon: Users, color: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-100' },
          { label: 'أطباء عبر المروجين', value: totalDoctors, icon: TrendingUp, color: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-100' },
          { label: 'إجمالي المحافظ للمروجين', value: `${totalWalletBalance.toLocaleString()} د.ع`, icon: Trophy, color: 'from-amber-500 to-orange-500', shadow: 'shadow-amber-100' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-3xl border border-slate-100 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex-1 text-right">
              <p className="text-xs font-bold text-slate-400 uppercase">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 mt-0.5">{stat.value}</p>
            </div>
            <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md ${stat.shadow} flex-shrink-0`}>
              <stat.icon className="w-5 h-5 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Form Panel */}
      {panel !== 'none' && (
        <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-sm p-6 space-y-4 text-right">
          <h2 className="font-black text-slate-900">{panel === 'add' ? 'إضافة مروج جديد' : 'تعديل بيانات المروج'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FORM_FIELD label="الاسم الكامل" value={form.name} onChange={(e: any) => setForm({ ...form, name: e.target.value })} />
            <FORM_FIELD label="البريد الإلكتروني" value={form.email} dir="ltr" type="email" onChange={(e: any) => setForm({ ...form, email: e.target.value })} />
            <FORM_FIELD label="رقم الهاتف" value={form.phone} dir="ltr" onChange={(e: any) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="flex gap-3 justify-start">
            <button onClick={() => setPanel('none')} className="px-5 py-2.5 rounded-2xl border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-50">إلغاء</button>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 rounded-2xl font-bold text-sm text-white disabled:opacity-60 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
              {saving ? 'جاري الحفظ...' : panel === 'add' ? 'إضافة المروج' : 'حفظ التغييرات'}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="ابحث عن مروج..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full h-11 pr-11 pl-4 rounded-2xl border-2 border-slate-100 bg-white text-slate-800 font-medium placeholder:text-slate-400 text-sm focus:outline-none focus:border-indigo-400 transition-all" />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">جاري تحميل المروجين...</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
                <Star className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-slate-400 font-bold text-sm">لا يوجد مروجون مسجلون بعد</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-50">
                    {['المروج', 'أطباء مضافون', 'المحفظة', 'الحالة', 'إجراءات'].map(h => (
                      <th key={h} className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(p => {
                    const isActive = (p as any).status !== 'inactive';
                    const balance = p.wallet_balance || 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                              style={{ background: 'linear-gradient(135deg, #f59e0b, #f97316)' }}>
                              {p.name?.charAt(0)}
                            </div>
                            <div className="text-right">
                              <p className="font-black text-slate-900 text-sm">{p.name}</p>
                              <p className="text-xs text-slate-400" dir="ltr">{p.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-black text-slate-900 text-sm">{p.doctorCount}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs font-bold text-slate-700">{balance.toLocaleString()} د.ع</span>
                            <button onClick={() => setWalletModal({ open: true, promoter: p, amount: '', desc: 'تعديل إداري للرصيد' })}
                              className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-colors">
                              <Wallet className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] font-black px-2.5 py-1.5 rounded-xl border ${isActive ? 'text-emerald-600 bg-emerald-50 border-emerald-100' : 'text-red-600 bg-red-50 border-red-100'}`}>
                            {isActive ? 'نشط' : 'معطل/محظور'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-xl bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => toggleStatus(p)} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isActive ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                              {isActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors">
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
          )}
        </div>
      )}

      {/* Wallet Adjustment Modal */}
      {walletModal.open && walletModal.promoter && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl max-w-md w-full overflow-hidden text-right">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <button onClick={() => setWalletModal({ open: false, promoter: null, amount: '', desc: 'تعديل إداري للرصيد' })}
                className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-black text-slate-900">تعديل رصيد المحفظة</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500">
                المروج: <strong className="text-slate-800">{walletModal.promoter.name}</strong>
              </p>
              <p className="text-xs text-slate-400">
                الرصيد الحالي: {(walletModal.promoter.wallet_balance || 0).toLocaleString()} د.ع
              </p>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">القيمة المراد إضافتها أو خصمها (د.ع)</label>
                <input type="number" placeholder="مثال: 25000 للإيداع، أو -15000 للخصم" value={walletModal.amount}
                  onChange={e => setWalletModal({ ...walletModal, amount: e.target.value })} dir="ltr"
                  className="w-full h-11 px-4 rounded-xl border-2 border-slate-100 text-slate-800 font-bold focus:outline-none focus:border-indigo-400 transition-all text-center" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-600 block">سبب التعديل</label>
                <input type="text" placeholder="مثال: عمولة مبيعات أو شحن رصيد" value={walletModal.desc}
                  onChange={e => setWalletModal({ ...walletModal, desc: e.target.value })}
                  className="w-full h-11 px-4 rounded-xl border-2 border-slate-100 text-slate-800 font-medium focus:outline-none focus:border-indigo-400 transition-all" />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 justify-start">
              <button onClick={() => setWalletModal({ open: false, promoter: null, amount: '', desc: 'تعديل إداري للرصيد' })}
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
