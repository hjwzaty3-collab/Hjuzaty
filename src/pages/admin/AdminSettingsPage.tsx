import React, { useState, useEffect } from 'react';
import { Save, Globe, Bell, Shield, Palette, Database, ChevronLeft, ShieldAlert, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const SECTIONS = [
  { id: 'general', label: 'الإعدادات العامة', icon: Globe },
  { id: 'notifications', label: 'الإشعارات', icon: Bell },
  { id: 'security', label: 'الأمان', icon: Shield },
  { id: 'appearance', label: 'المظهر', icon: Palette },
  { id: 'database', label: 'قاعدة البيانات', icon: Database },
  { id: 'blocked', label: 'الأرقام المحظورة', icon: ShieldAlert },
];

const TOGGLE = ({ label, desc, value, onChange }: any) => (
  <div className="flex items-center justify-between py-4 border-b border-slate-50 last:border-0">
    <button onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-all duration-300 flex-shrink-0 ${value ? '' : 'bg-slate-200'}`}
      style={value ? { background: 'linear-gradient(135deg, #3730a3, #4f46e5)' } : {}}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${value ? 'right-1' : 'right-6'}`} />
    </button>
    <div className="text-right flex-1 ml-4">
      <p className="font-bold text-slate-800 text-sm">{label}</p>
      {desc && <p className="text-xs text-slate-400 font-medium mt-0.5">{desc}</p>}
    </div>
  </div>
);

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [settings, setSettings] = useState({
    siteName: 'حجوزاتي',
    supportEmail: 'support@hujuzati.com',
    maintenanceMode: false,
    emailNotifications: true,
    smsNotifications: false,
    newBookingAlert: true,
    twoFactor: false,
    autoLogout: true,
    darkMode: false,
    rtlLayout: true,
    autoBackup: true,
  });

  // Blocked Numbers state
  const [blockedNumbers, setBlockedNumbers] = useState<any[]>([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newReason, setNewReason] = useState('مخالفة شروط الخدمة');
  const [addingBlock, setAddingBlock] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data: twoFactorEnabled, error } = await supabase.rpc('is_two_factor_enabled');
      if (error) throw error;
      setSettings(prev => ({
        ...prev,
        twoFactor: !!twoFactorEnabled
      }));
    } catch (e) {
      console.error('Failed to fetch settings from DB:', e);
    }
  };

  useEffect(() => {
    if (activeSection === 'blocked') {
      fetchBlockedNumbers();
    }
  }, [activeSection]);

  const fetchBlockedNumbers = async () => {
    setLoadingBlocked(true);
    try {
      const { data, error } = await supabase
        .from('blocked_numbers')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBlockedNumbers(data || []);
    } catch (e: any) {
      console.error(e);
      toast.error('فشل تحميل قائمة الحظر: ' + e.message);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhone.trim()) {
      toast.error('يرجى إدخال رقم هاتف صالح');
      return;
    }
    setAddingBlock(true);
    try {
      const { error } = await supabase.rpc('admin_block_phone_number', {
        p_phone: newPhone.trim(),
        p_reason: newReason.trim()
      });
      if (error) throw error;
      toast.success('تم حظر الرقم وتعطيل حسابات المالك بنجاح ✓');
      setNewPhone('');
      setNewReason('مخالفة شروط الخدمة');
      fetchBlockedNumbers();
    } catch (e: any) {
      toast.error('فشل حظر الرقم: ' + e.message);
    } finally {
      setAddingBlock(false);
    }
  };

  const handleRemoveBlock = async (phone: string) => {
    if (!confirm(`هل أنت متأكد من فك الحظر عن الرقم ${phone}؟`)) return;
    try {
      const { error } = await supabase.rpc('admin_unblock_phone_number', {
        p_phone: phone
      });
      if (error) throw error;
      toast.success('تم فك حظر الرقم وتنشيط حسابات المالك ✓');
      fetchBlockedNumbers();
    } catch (e: any) {
      toast.error('فشل فك الحظر: ' + e.message);
    }
  };

  const toggle = async (key: string) => {
    if (key === 'twoFactor') {
      const nextVal = !settings.twoFactor;
      setSettings(prev => ({ ...prev, twoFactor: nextVal }));
      try {
        const { error } = await supabase.rpc('set_two_factor_enabled', { p_enabled: nextVal });
        if (error) throw error;
        toast.success(`تم ${nextVal ? 'تفعيل' : 'تعطيل'} المصادقة الثنائية بنجاح ✓`);
      } catch (e: any) {
        toast.error('فشل تحديث إعدادات الأمان: ' + e.message);
        setSettings(prev => ({ ...prev, twoFactor: !nextVal }));
      }
    } else {
      setSettings(prev => ({ ...prev, [key]: !(prev as any)[key] }));
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase.rpc('set_two_factor_enabled', { p_enabled: settings.twoFactor });
      if (error) throw error;
      toast.success('تم حفظ الإعدادات ✓');
    } catch (e: any) {
      toast.error('حدث خطأ أثناء حفظ الإعدادات: ' + e.message);
    }
  };

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        {activeSection !== 'blocked' ? (
          <button onClick={handleSave}
            className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
            <Save className="w-4 h-4" />
            حفظ الإعدادات
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">إعدادات النظام</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">تكوين المنصة وإعداداتها</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Sidebar nav */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-3 space-y-1 h-fit">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-bold transition-all ${activeSection === s.id ? 'text-white' : 'text-slate-600 hover:bg-slate-50'}`}
              style={activeSection === s.id ? { background: 'linear-gradient(135deg, #3730a3, #4f46e5)' } : {}}>
              <ChevronLeft className={`w-4 h-4 transition-opacity ${activeSection === s.id ? 'opacity-100' : 'opacity-0'}`} />
              <div className="flex items-center gap-2.5">
                {s.label}
                <s.icon className="w-4 h-4" />
              </div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-2 text-right">
          {activeSection === 'general' && (
            <>
              <div className="mb-5">
                <h2 className="font-black text-slate-900">الإعدادات العامة</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">معلومات المنصة الأساسية</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'اسم المنصة', key: 'siteName', dir: 'rtl' },
                  { label: 'البريد الإلكتروني للدعم', key: 'supportEmail', dir: 'ltr' },
                ].map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">{f.label}</label>
                    <input value={(settings as any)[f.key]}
                      onChange={e => setSettings({ ...settings, [f.key]: e.target.value })}
                      dir={f.dir}
                      className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
                  </div>
                ))}
              </div>
              <div className="pt-2">
                <TOGGLE label="وضع الصيانة" desc="إيقاف المنصة مؤقتاً لأغراض الصيانة" value={settings.maintenanceMode} onChange={() => toggle('maintenanceMode')} />
              </div>
            </>
          )}

          {activeSection === 'notifications' && (
            <>
              <div className="mb-5">
                <h2 className="font-black text-slate-900">إعدادات الإشعارات</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">تحكم في كيفية إرسال الإشعارات</p>
              </div>
              <TOGGLE label="إشعارات البريد الإلكتروني" desc="إرسال تأكيدات الحجز عبر البريد" value={settings.emailNotifications} onChange={() => toggle('emailNotifications')} />
              <TOGGLE label="إشعارات SMS" desc="إرسال رسائل نصية للمرضى" value={settings.smsNotifications} onChange={() => toggle('smsNotifications')} />
              <TOGGLE label="تنبيه الحجز الجديد" desc="إشعار الأطباء فوراً عند الحجز" value={settings.newBookingAlert} onChange={() => toggle('newBookingAlert')} />
            </>
          )}

          {activeSection === 'security' && (
            <>
              <div className="mb-5">
                <h2 className="font-black text-slate-900">إعدادات الأمان</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">حماية الحسابات والبيانات</p>
              </div>
              <TOGGLE label="المصادقة الثنائية (2FA)" desc="تفعيل إضافي للتحقق من الهوية" value={settings.twoFactor} onChange={() => toggle('twoFactor')} />
              <TOGGLE label="تسجيل الخروج التلقائي" desc="إنهاء الجلسات غير النشطة بعد 30 دقيقة" value={settings.autoLogout} onChange={() => toggle('autoLogout')} />
            </>
          )}

          {activeSection === 'appearance' && (
            <>
              <div className="mb-5">
                <h2 className="font-black text-slate-900">إعدادات المظهر</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">تخصيص شكل المنصة</p>
              </div>
              <TOGGLE label="الوضع الليلي" desc="تفعيل المظهر الداكن للمنصة" value={settings.darkMode} onChange={() => toggle('darkMode')} />
              <TOGGLE label="التخطيط من اليمين لليسار (RTL)" desc="دعم اللغة العربية بشكل صحيح" value={settings.rtlLayout} onChange={() => toggle('rtlLayout')} />
            </>
          )}

          {activeSection === 'database' && (
            <>
              <div className="mb-5">
                <h2 className="font-black text-slate-900">قاعدة البيانات</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">إدارة البيانات والنسخ الاحتياطي</p>
              </div>
              <TOGGLE label="النسخ الاحتياطي التلقائي" desc="حفظ نسخة احتياطية يومية تلقائياً" value={settings.autoBackup} onChange={() => toggle('autoBackup')} />
              <div className="pt-4 space-y-3">
                <button className="w-full py-3 rounded-2xl border-2 border-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-50 transition-colors">
                  تنزيل نسخة احتياطية الآن
                </button>
                <button className="w-full py-3 rounded-2xl border-2 border-red-100 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors">
                  مسح البيانات المؤقتة
                </button>
              </div>
            </>
          )}

          {activeSection === 'blocked' && (
            <>
              <div className="mb-5">
                <h2 className="font-black text-slate-900">قائمة الأرقام المحظورة (Blacklist)</h2>
                <p className="text-xs text-slate-400 font-bold mt-0.5">منع أرقام هواتف معينة من التسجيل أو تسجيل الدخول</p>
              </div>

              {/* Add block form */}
              <form onSubmit={handleAddBlock} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 space-y-3">
                <h3 className="text-xs font-black text-slate-600 uppercase tracking-wider">حظر رقم هاتف جديد</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">رقم الهاتف</label>
                    <input type="text" placeholder="مثال: 07700000000" value={newPhone}
                      onChange={e => setNewPhone(e.target.value)} dir="ltr"
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-xs font-bold focus:outline-none focus:border-indigo-400 transition-all text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 block">سبب الحظر</label>
                    <input type="text" placeholder="مثال: مخالفة شروط الخدمة" value={newReason}
                      onChange={e => setNewReason(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-850 text-xs font-medium focus:outline-none focus:border-indigo-400 transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={addingBlock}
                  className="flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl text-white font-bold text-xs hover:opacity-90 transition-all disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #e11d48, #be123c)' }}>
                  <Plus className="w-3.5 h-3.5" />
                  {addingBlock ? 'جاري إضافة الحظر...' : 'إضافة إلى القائمة السوداء'}
                </button>
              </form>

              {/* Block list table */}
              {loadingBlocked ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2">
                  <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
                  <p className="text-slate-400 text-xs font-medium">جاري تحميل القائمة السوداء...</p>
                </div>
              ) : blockedNumbers.length === 0 ? (
                <div className="py-12 border border-dashed border-slate-250 rounded-2xl text-center text-slate-400 text-xs font-bold">
                  لا توجد أرقام محظورة حالياً.
                </div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-3 text-right font-black text-slate-400">رقم الهاتف</th>
                        <th className="px-4 py-3 text-right font-black text-slate-400">السبب</th>
                        <th className="px-4 py-3 text-right font-black text-slate-400">تاريخ الحظر</th>
                        <th className="px-4 py-3 text-center font-black text-slate-400">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {blockedNumbers.map((b) => (
                        <tr key={b.phone} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-800 text-right" dir="ltr">{b.phone}</td>
                          <td className="px-4 py-3 font-medium text-slate-500 text-right">{b.reason || '—'}</td>
                          <td className="px-4 py-3 text-slate-400 text-right">
                            {new Date(b.created_at).toLocaleDateString('ar-IQ')}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => handleRemoveBlock(b.phone)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold transition-all inline-flex items-center gap-1">
                              <Trash2 className="w-3 h-3" />
                              إلغاء الحظر
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
