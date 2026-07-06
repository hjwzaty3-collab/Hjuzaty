import { supabase } from '@/lib/supabase';
import { Notification } from '@/types';

export const sendNotification = async (
  userId: string, 
  title: string, 
  message: string, 
  type: Notification['type'] = 'INFO',
  notifyAdmin: boolean = false
) => {
  try {
    const { error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: type || 'INFO',
      p_notify_admin: notifyAdmin
    });
    if (error) throw error;
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};

export const notifyAppointmentStatus = async (
  userId: string,
  appointmentId: string,
  status: string,
  role: 'DOCTOR' | 'PATIENT',
  notifyAdmin: boolean = false
) => {
  let title = '';
  let message = '';
  let type: Notification['type'] = 'INFO';

  const normalizedStatus = (status || '').toUpperCase();

  if (role === 'DOCTOR') {
    switch (normalizedStatus) {
      case 'CONFIRMED':
        title = 'تم تأكيد الموعد';
        message = `تم تأكيد موعدك رقم ${appointmentId} من قبل الطبيب.`;
        type = 'SUCCESS';
        break;
      case 'CANCELLED':
        title = 'تم إلغاء الموعد';
        message = `للأسف، تم إلغاء موعدك رقم ${appointmentId} من قبل الطبيب.`;
        type = 'ERROR';
        break;
      case 'COMPLETED':
        title = 'اكتمل الموعد';
        message = `تم وضع علامة "مكتمل" على موعدك رقم ${appointmentId}. نتمنى لك دوام الصحة.`;
        type = 'SUCCESS';
        break;
    }
  } else {
    switch (normalizedStatus) {
      case 'PENDING':
        title = 'موعد جديد';
        message = `لديك طلب موعد جديد رقم ${appointmentId}.`;
        type = 'INFO';
        break;
      case 'CANCELLED':
        title = 'موعد ملغى';
        message = `قام المريض بإلغاء الموعد رقم ${appointmentId}.`;
        type = 'WARNING';
        break;
    }
  }

  if (title && message) {
    await sendNotification(userId, title, message, type, notifyAdmin);
  }
};

