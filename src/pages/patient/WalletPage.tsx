import { useState, useEffect } from 'react';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Loader2, Download, Gift, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

const isValidUUID = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export default function WalletPage() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  // Redeem code state
  const [showRedeem, setShowRedeem] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchData();
    if (!isValidUUID(user.id)) return;

    const userCh = supabase.channel(`wallet-user-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` },
        (payload) => setBalance(payload.new.wallet_balance || 0))
      .subscribe();

    return () => { supabase.removeChannel(userCh); };
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchBalance(), fetchTransactions()]);
    setLoading(false);
  };

  const fetchBalance = async () => {
    if (!user) return;
    // Use SECURITY DEFINER RPC (works for anon patients)
    const { data } = await supabase.rpc('get_wallet_balance', { p_user_id: user.id });
    if (data !== null) setBalance(Number(data));
  };

  const fetchTransactions = async () => {
    if (!user) return;
    const { data } = await supabase.rpc('get_my_transactions', { p_user_id: user.id });
    if (data) setTransactions(data);
  };

  const handleRedeem = async () => {
    if (!user || !redeemCode.trim()) return;
    setRedeeming(true);
    try {
      const { data, error } = await supabase.rpc('redeem_code', {
        p_code:       redeemCode.trim().toUpperCase(),
        p_patient_id: user.id,
      });

      if (error) throw new Error(error.message);

      const result = data as any;
      if (!result.success) {
        if (result.error === 'CODE_NOT_FOUND') toast.error('الكود غير صحيح أو غير موجود');
        else if (result.error === 'CODE_ALREADY_USED') toast.error('هذا الكود مستخدم مسبقاً');
        else toast.error('فشل استرداد الكود');
        return;
      }

      const newBalance = Number(result.new_balance);
      toast.success(`تم إضافة ${Number(result.amount).toLocaleString()} د.ع إلى محفظتك! 🎉`);
      setBalance(newBalance);
      // Update auth store balance
      if (user) setAuth({ ...user, wallet_balance: newBalance });
      setRedeemCode('');
      setShowRedeem(false);
      await fetchTransactions();
    } catch (e: any) {
      toast.error('حدث خطأ: ' + e.message);
    } finally {
      setRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-medium text-sm">جاري تحميل بيانات المحفظة...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <div className="text-right">
        <h1 className="text-2xl font-black text-slate-900">محفظتي</h1>
        <p className="text-slate-500 text-sm font-medium mt-0.5">رصيدك وسجل معاملاتك</p>
      </div>

      {/* Balance card */}
      <div className="rounded-3xl p-7 text-white relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #4f46e5 60%, #7c3aed 100%)' }}>
        <div className="absolute top-0 right-0 w-40 h-40 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-4 h-4 opacity-70" />
            <p className="text-white/70 text-sm font-bold uppercase tracking-wider">إجمالي الرصيد</p>
          </div>
          <p className="text-5xl font-black mb-1">{balance.toLocaleString()}</p>
          <p className="text-xl font-bold text-white/60">دينار عراقي</p>

          <button onClick={() => setShowRedeem(!showRedeem)}
            className="mt-5 flex items-center gap-2 text-sm font-bold bg-white text-indigo-700 px-5 py-2.5 rounded-2xl hover:bg-indigo-50 transition-colors">
            <Gift className="w-4 h-4" />
            شحن الرصيد بكود
          </button>
        </div>
      </div>

      {/* Redeem code form */}
      {showRedeem && (
        <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-sm p-6 space-y-4 text-right">
          <div className="flex items-center justify-end gap-3">
            <div>
              <h2 className="font-black text-slate-900">استرداد كود الشحن</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">أدخل الكود الذي حصلت عليه لشحن رصيدك</p>
            </div>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)' }}>
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleRedeem} disabled={redeeming || !redeemCode.trim()}
              className="flex-shrink-0 px-6 py-3 rounded-2xl font-bold text-sm text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
              {redeeming ? <><Loader2 className="w-4 h-4 animate-spin" />جاري...</> : 'استرداد'}
            </button>
            <input
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleRedeem()}
              placeholder="أدخل الكود هنا..."
              dir="ltr"
              maxLength={12}
              className="flex-1 h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-mono font-bold tracking-widest placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all text-center"
            />
          </div>

          <button onClick={() => { setShowRedeem(false); setRedeemCode(''); }}
            className="text-xs text-slate-400 font-bold hover:text-slate-600 transition-colors">
            إلغاء
          </button>
        </div>
      )}

      {/* Transaction history */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 border border-slate-100 hover:border-slate-200 px-3 py-2 rounded-xl transition-all">
            <Download className="w-3.5 h-3.5" />
            تصدير
          </button>
          <div className="text-right">
            <h2 className="font-black text-slate-900">سجل المعاملات</h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">{transactions.length} معاملة</p>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-slate-300" />
            </div>
            <p className="text-slate-400 font-bold text-sm">لا توجد معاملات بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {transactions.map(tx => {
              const isCredit = Number(tx.amount) > 0;
              const desc = tx.description || tx.type || 'معاملة';
              return (
                <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${isCredit ? 'bg-emerald-50' : 'bg-slate-50'}`}>
                      {isCredit
                        ? <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                        : <ArrowUpRight className="w-4 h-4 text-slate-500" />}
                    </div>
                    <div className="text-right">
                      <p className="font-black text-slate-800 text-sm">{desc}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString('ar-IQ') : ''}
                      </p>
                    </div>
                  </div>
                  <div className={`text-base font-black ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`} dir="ltr">
                    {isCredit ? `+${Number(tx.amount).toLocaleString()}` : Number(tx.amount).toLocaleString()}
                    <span className="text-xs font-bold text-slate-400 mr-1">د.ع</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
