import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  Check, 
  Info, 
  AlertTriangle, 
  XCircle,
  X,
  ExternalLink,
  CheckCheck
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/useAuthStore';
import { supabase } from '@/lib/supabase';
import { Notification } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

export default function NotificationsPopover() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${user.id}-${Math.random().toString(36).substring(7)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const notifs = data as Notification[];
      setNotifications(notifs);
      setUnreadCount(notifs.filter(n => !n.is_read).length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      
      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'SUCCESS': return <Check className="w-4 h-4 text-emerald-600 animate-in zoom-in duration-300" />;
      case 'WARNING': return <AlertTriangle className="w-4 h-4 text-amber-600 animate-in zoom-in duration-300" />;
      case 'ERROR': return <XCircle className="w-4 h-4 text-red-600 animate-in zoom-in duration-300" />;
      default: return <Info className="w-4 h-4 text-indigo-600 animate-in zoom-in duration-300" />;
    }
  };

  const getTypeStyles = (type: Notification['type']) => {
    switch (type) {
      case 'SUCCESS': return 'bg-emerald-50 border-emerald-100';
      case 'WARNING': return 'bg-amber-50 border-amber-100';
      case 'ERROR': return 'bg-red-50 border-red-100';
      default: return 'bg-indigo-50 border-indigo-100';
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="w-10 h-10 rounded-2xl relative hover:bg-slate-100 active:scale-95 transition-all">
          <Bell className="w-5 h-5 text-slate-500" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-4 h-4 bg-indigo-600 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse border-2 border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[calc(100vw-32px)] sm:w-96 p-0 rounded-3xl overflow-hidden shadow-2xl border-slate-100 bg-white" 
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-50 bg-white flex items-center justify-between" dir="rtl">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-900 text-sm">التنبيهات</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-indigo-50 text-indigo-600 font-bold border-none text-[10px] py-0.5 px-2 rounded-xl pointer-events-none">
                {unreadCount} جديد
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <button 
              className="text-xs text-indigo-600 hover:text-indigo-750 font-bold flex items-center gap-1 hover:underline transition-all"
              onClick={markAllAsRead}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              قراءة الكل
            </button>
          )}
        </div>
        
        {/* Content list */}
        <ScrollArea className="h-[360px] no-scrollbar">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[360px] p-8 text-center text-slate-400">
              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                <Bell className="w-8 h-8 text-slate-350" />
              </div>
              <p className="text-sm font-black text-slate-700">لا توجد تنبيهات حالياً</p>
              <p className="text-xs mt-1 text-slate-400">سنخطرك عندما يكون هناك تحديث جديد لمواعيدك</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {notifications.map((notification) => (
                <div 
                  key={notification.id}
                  className={`p-4 transition-all hover:bg-slate-50/70 cursor-pointer relative group ${!notification.is_read ? 'bg-indigo-50/15' : ''}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="flex gap-3 items-start" dir="rtl">
                    {/* Icon container */}
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 border ${getTypeStyles(notification.type)}`}>
                      {getIcon(notification.type)}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[9px] text-slate-455 font-bold whitespace-nowrap self-start mt-0.5">
                          {notification.created_at ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ar }) : 'الآن'}
                        </span>
                        <p className={`text-sm font-black truncate leading-tight ${!notification.is_read ? 'text-indigo-650' : 'text-slate-800'}`}>
                          {notification.title}
                        </p>
                      </div>
                      <p className="text-xs text-slate-550 mt-1 leading-relaxed font-semibold">
                        {notification.message}
                      </p>
                    </div>
                  </div>
                  {/* Delete button */}
                  <button 
                    className="absolute top-3 left-3 p-1.5 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all duration-200"
                    onClick={(e) => deleteNotification(e, notification.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  {/* Read indicator */}
                  {!notification.is_read && (
                    <div className="absolute top-1/2 right-1.5 transform -translate-y-1/2 w-1.5 h-6 bg-indigo-500 rounded-full" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
