import React, { useState, useEffect } from 'react';
import {
  Gift, Plus, Copy, Check, Loader2, RefreshCw,
  Wallet, Hash, CheckCircle2, XCircle, Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000, 100000, 250000];
const PRESET_QUANTITIES = [1, 2, 5, 10, 20, 50];

const CodeCard: React.FC<{ code: any }> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`relative rounded-3xl p-5 overflow-hidden border-2 transition-all ${
      code.is_used
        ? 'bg-slate-50 border-slate-100 opacity-60'
        : 'bg-white border-indigo-100 hover:shadow-lg hover:shadow-indigo-50'
    }`}>
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, #4f46e5 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      <div className="relative z-10">
        {/* Status badge */}
        <div className="flex items-center justify-between mb-4">
          <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl flex items-center gap-1 ${
            code.is_used
              ? 'bg-slate-100 text-slate-400'
              : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
          }`}>
            {code.is_used
              ? <><XCircle className="w-3 h-3" />مستخدم</>
              : <><CheckCircle2 className="w-3 h-3" />متاح</>}
          </span>
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: code.is_used ? '#f1f5f9' : 'linear-gradient(135deg,#3730a3,#4f46e5)' }}>
            <Gift className={`w-4 h-4 ${code.is_used ? 'text-slate-400' : 'text-white'}`} />
          </div>
        </div>

        {/* Amount */}
        <p className="text-2xl font-black text-slate-900 text-right mb-1">
          {Number(code.amount).toLocaleString()}
          <span className="text-sm text-slate-400 font-bold mr-1">د.ع</span>
        </p>
        <p className="text-xs text-slate-400 font-bold text-right mb-4">قيمة الكود</p>

        {/* Code + copy */}
        <div className={`flex items-center justify-between px-3 py-2.5 rounded-2xl ${
          code.is_used ? 'bg-slate-100' : 'bg-indigo-50'
        }`}>
          <button onClick={copy} disabled={code.is_used}
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
              code.is_used ? 'text-slate-300' : 'text-indigo-600 hover:bg-indigo-100'
            }`}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <span className="font-mono font-black text-sm tracking-widest text-slate-800 select-all" dir="ltr">
            {code.code}
          </span>
        </div>

        {code.is_used && code.used_at && (
          <p className="text-[10px] text-slate-400 font-bold text-right mt-2">
            استُخدم {new Date(code.used_at).toLocaleDateString('ar-IQ')}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AdminRedeemCodesPage() {
  const user = useAuthStore(s => s.user);
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showFeeSettings, setShowFeeSettings] = useState(false);

  // Generator state
  const [amount, setAmount] = useState(25000);
  const [customAmount, setCustomAmount] = useState('');
  const [quantity, setQuantity] = useState(5);

  // Platform fee state
  const [platformFee, setPlatformFee] = useState(0);
  const [feeInput, setFeeInput] = useState('0');

  // Filter
  const [filter, setFilter] = useState<'all' | 'available' | 'used'>('all');

  useEffect(() => { fetchCodes(); fetchFee(); }, []);

  const fetchCodes = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_redeem_codes');
    if (error) console.error('get_redeem_codes:', error.message);
    setCodes(data || []);
    setLoading(false);
  };

  const fetchFee = async () => {
    const { data } = await supabase.rpc('get_platform_fee');
    if (data !== null) { setPlatformFee(Number(data)); setFeeInput(String(data)); }
  };

  const handleGenerate = async () => {
    if (!user) return;
    const finalAmount = customAmount ? Number(customAmount) : amount;
    if (!finalAmount || finalAmount <= 0) { toast.error('يرجى إدخال قيمة صحيحة'); return; }
    setGenerating(true);
    try {
      const { data, error } = await supabase.rpc('create_redeem_codes', {
        p_amount: finalAmount,
        p_quantity: quantity,
        p_created_by: user.id,
      });
      if (error) throw error;
      toast.success(`تم إنشاء ${quantity} كود بقيمة ${finalAmount.toLocaleString()} د.ع ✓`);
      setShowGenerator(false);
      setCustomAmount('');
      await fetchCodes();
    } catch (e: any) {
      toast.error('فشل إنشاء الأكواد: ' + e.message);
    } finally { setGenerating(false); }
  };

  const handleSaveFee = async () => {
    setSaving(true);
    try {
      const fee = Number(feeInput) || 0;
      const { error } = await supabase.rpc('set_platform_fee', { p_fee: fee });
      if (error) throw error;
      setPlatformFee(fee);
      toast.success('تم حفظ رسوم الخدمة ✓');
      setShowFeeSettings(false);
    } catch (e: any) {
      toast.error('فشل الحفظ: ' + e.message);
    } finally { setSaving(false); }
  };

  const filtered = codes.filter(c =>
    filter === 'all' ? true : filter === 'available' ? !c.is_used : c.is_used
  );
  const usedCount = codes.filter(c => c.is_used).length;
  const availableCount = codes.filter(c => !c.is_used).length;

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFeeSettings(!showFeeSettings)}
            className="flex items-center gap-2 text-sm font-bold text-slate-600 py-2.5 px-4 rounded-2xl border-2 border-slate-100 hover:bg-slate-50 transition-all">
            <Settings2 className="w-4 h-4" />
            رسوم الخدمة: {platformFee.toLocaleString()} د.ع
          </button>
          <button onClick={() => setShowGenerator(!showGenerator)}
            className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
            <Plus className="w-4 h-4" />
            إنشاء أكواد
          </button>
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">أكواد الشحن</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">
            {codes.length} كود إجمالاً · {availableCount} متاح · {usedCount} مستخدم
          </p>
        </div>
      </div>

      {/* Platform Fee Settings */}
      {showFeeSettings && (
        <div className="bg-white rounded-3xl border-2 border-amber-100 shadow-sm p-6 space-y-4 text-right">
          <div className="flex items-center justify-end gap-2">
            <div>
              <h2 className="font-black text-slate-900">رسوم خدمة المنصة</h2>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                تُضاف تلقائياً لكل حجز — تذهب لحساب المنصة
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs font-black text-slate-500 uppercase mb-1.5 block">المبلغ (دينار عراقي)</label>
              <input type="number" value={feeInput} onChange={e => setFeeInput(e.target.value)}
                placeholder="0"
                className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-bold placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all" />
            </div>
          </div>

          <div className="bg-amber-50 rounded-2xl p-3 text-right">
            <p className="text-xs text-amber-700 font-bold">
              مثال: إذا كانت الكشفية 13,000 د.ع ورسوم الخدمة {Number(feeInput || 0).toLocaleString()} د.ع،
              سيرى المريض الإجمالي {(13000 + Number(feeInput || 0)).toLocaleString()} د.ع.
              يذهب 13,000 للطبيب و{Number(feeInput || 0).toLocaleString()} للمنصة.
            </p>
          </div>

          <div className="flex gap-3 justify-start">
            <button onClick={() => setShowFeeSettings(false)}
              className="px-5 py-2.5 rounded-2xl border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-50">
              إلغاء
            </button>
            <button onClick={handleSaveFee} disabled={saving}
              className="px-6 py-2.5 rounded-2xl font-bold text-sm text-white hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)' }}>
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </button>
          </div>
        </div>
      )}

      {/* Code Generator */}
      {showGenerator && (
        <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-sm p-6 space-y-5 text-right">
          <h2 className="font-black text-slate-900 flex items-center justify-end gap-2">
            <Gift className="w-5 h-5 text-indigo-500" />
            إنشاء أكواد شحن جديدة
          </h2>

          {/* Amount presets */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase block">قيمة الكود</label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PRESET_AMOUNTS.map(a => (
                <button key={a} onClick={() => { setAmount(a); setCustomAmount(''); }}
                  className={`py-2.5 rounded-2xl text-sm font-black border-2 transition-all ${
                    amount === a && !customAmount
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-100 text-slate-500 hover:border-slate-200'
                  }`}>
                  {a >= 1000 ? `${a / 1000}K` : a}
                </button>
              ))}
            </div>
            <input type="number" placeholder="أو أدخل قيمة مخصصة..."
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all mt-2" />
          </div>

          {/* Quantity presets */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-500 uppercase block">الكمية</label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_QUANTITIES.map(q => (
                <button key={q} onClick={() => setQuantity(q)}
                  className={`py-2.5 rounded-2xl text-sm font-black border-2 transition-all ${
                    quantity === q
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                      : 'border-slate-100 text-slate-500 hover:border-slate-200'
                  }`}>
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-indigo-50 rounded-2xl p-4 text-right">
            <p className="text-sm font-black text-indigo-800">
              سيتم إنشاء <span className="text-indigo-600">{quantity}</span> كود
              بقيمة <span className="text-indigo-600">{(customAmount ? Number(customAmount) : amount).toLocaleString()}</span> د.ع لكل كود
            </p>
            <p className="text-xs text-indigo-500 font-bold mt-0.5">
              الإجمالي: {((customAmount ? Number(customAmount) : amount) * quantity).toLocaleString()} د.ع
            </p>
          </div>

          <div className="flex gap-3 justify-start">
            <button onClick={() => { setShowGenerator(false); setCustomAmount(''); }}
              className="px-5 py-2.5 rounded-2xl border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-50">
              إلغاء
            </button>
            <button onClick={handleGenerate} disabled={generating}
              className="px-6 py-2.5 rounded-2xl font-bold text-sm text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
              {generating ? <><Loader2 className="w-4 h-4 animate-spin" />جاري الإنشاء...</> : <><Plus className="w-4 h-4" />إنشاء الأكواد</>}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
          {([['all', 'الكل', codes.length], ['available', 'متاح', availableCount], ['used', 'مستخدم', usedCount]] as const).map(([id, label, count]) => (
            <button key={id} onClick={() => setFilter(id)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filter === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {label}
              <span className={`mr-1.5 text-[10px] font-black ${filter === id ? 'text-indigo-600' : 'text-slate-400'}`}>{count}</span>
            </button>
          ))}
        </div>
        <button onClick={fetchCodes} className="w-9 h-9 rounded-xl border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Codes grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">جاري تحميل الأكواد...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 text-center">
          <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-5">
            <Hash className="w-9 h-9 text-slate-300" />
          </div>
          <h3 className="text-lg font-black text-slate-700 mb-2">لا توجد أكواد بعد</h3>
          <p className="text-slate-400 font-medium text-sm mb-6">ابدأ بإنشاء أكواد شحن لمستخدمي المنصة</p>
          <button onClick={() => setShowGenerator(true)}
            className="px-8 py-3 rounded-2xl font-black text-sm text-white"
            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
            إنشاء أكواد الآن
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(code => <CodeCard key={code.id} code={code} />)}
        </div>
      )}
    </div>
  );
}
