import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, Send, Users, UserCheck, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', target: 'all' });
  const [sending, setSending] = useState(false);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*, user:user_id (name, role)')
        .order('created_at', { ascending: false })
        .limit(30);
      setNotifications(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSend = async () => {
    if (!form.title || !form.body) return;
    setSending(true);
    try {
      // Get target users
      const { data: users } = await supabase.from('users').select('id, role');
      const targets = form.target === 'all' ? users :
        form.target === 'doctors' ? users?.filter((u: any) => u.role?.toUpperCase() === 'DOCTOR') :
          users?.filter((u: any) => u.role?.toUpperCase() === 'PATIENT');

      const inserts = (targets || []).map((u: any) => ({
        user_id: u.id,
        title: form.title,
        body: form.body,
        type: 'admin',
        is_read: false,
      }));

      if (inserts.length > 0) {
        const { error } = await supabase.from('notifications').insert(inserts);
        if (error) throw error;
      }

      toast.success(`تم إرسال الإشعار إلى ${inserts.length} مستخدم ✓`);
      setShowForm(false);
      setForm({ title: '', body: '', target: 'all' });
      fetchNotifications();
    } catch (e) { toast.error('فشل إرسال الإشعار'); }
    finally { setSending(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      toast.success('تم حذف الإشعار');
      fetchNotifications();
    } catch (e) { toast.error('فشل الحذف'); }
  };

  return (
    <div className="space-y-5 pb-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 text-sm font-bold text-white py-2.5 px-5 rounded-2xl hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
          <Send className="w-4 h-4" />
          إرسال إشعار جديد
        </button>
        <div className="text-right">
          <h1 className="text-2xl font-black text-slate-900">إدارة الإشعارات</h1>
          <p className="text-slate-500 text-sm font-medium mt-0.5">{notifications.length} إشعار في النظام</p>
        </div>
      </div>

      {/* Send Form */}
      {showForm && (
        <div className="bg-white rounded-3xl border-2 border-indigo-100 shadow-sm p-6 space-y-4 text-right">
          <h2 className="font-black text-slate-900">إرسال إشعار جماعي</h2>
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-500 uppercase">المستهدف</label>
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'الجميع', icon: Users },
                { id: 'doctors', label: 'الأطباء فقط', icon: UserCheck },
                { id: 'patients', label: 'المرضى فقط', icon: Users },
              ].map(t => (
                <button key={t.id} onClick={() => setForm({ ...form, target: t.id })}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-black border-2 transition-all ${form.target === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'}`}>
                  <t.icon className="w-3.5 h-3.5" />{t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase">عنوان الإشعار</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: تحديث سياسات النظام"
                className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-500 uppercase">نص الرسالة</label>
              <input value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
                placeholder="اكتب نص الإشعار هنا..."
                className="w-full h-12 px-4 rounded-2xl border-2 border-slate-100 bg-slate-50 text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-indigo-400 focus:bg-white transition-all" />
            </div>
          </div>
          <div className="flex gap-3 justify-start">
            <button onClick={() => setShowForm(false)} className="px-5 py-2.5 rounded-2xl border-2 border-slate-100 text-slate-500 font-bold text-sm hover:bg-slate-50">إلغاء</button>
            <button onClick={handleSend} disabled={sending || !form.title}
              className="px-6 py-2.5 rounded-2xl font-bold text-sm text-white disabled:opacity-60 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}>
              {sending ? 'جاري الإرسال...' : 'إرسال الإشعار'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-medium text-sm">جاري تحميل الإشعارات...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
            <BellOff className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-500 font-bold">لا توجد إشعارات بعد</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
          {notifications.map(n => {
            const user = Array.isArray(n.user) ? n.user[0] : n.user;
            return (
              <div key={n.id} className={`flex items-start gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors group ${!n.is_read ? 'bg-indigo-50/30' : ''}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleDelete(n.id)}
                    className="w-8 h-8 rounded-xl bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {!n.is_read && <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0" />}
                </div>
                <div className="flex-1 text-right">
                  <p className="font-black text-slate-900 text-sm">{n.title}</p>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-slate-400 mt-1.5">إلى: {user?.name || 'مستخدم'}</p>
                </div>
                <div className="w-9 h-9 rounded-2xl flex-shrink-0" style={{ background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)' }}>
                  <Bell className="w-4 h-4 text-indigo-600 m-2.5" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
