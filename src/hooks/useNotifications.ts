import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      toast.error('Benachrichtigungen werden nicht unterstützt');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast.success('Benachrichtigungen aktiviert!');
        return true;
      } else {
        toast.error('Benachrichtigungen abgelehnt');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Fehler beim Aktivieren der Benachrichtigungen');
      return false;
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'minuteman-notification',
        requireInteraction: true,
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const scheduleBreakReminder = (workStartTime: Date, breakReminderMinutes: number = 360) => {
    // Schedule reminder after specified minutes (default 6 hours)
    const reminderTime = new Date(workStartTime.getTime() + breakReminderMinutes * 60 * 1000);
    const now = new Date();
    const delay = reminderTime.getTime() - now.getTime();

    if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Only if within 24 hours
      const timeoutId = setTimeout(() => {
        sendNotification('Zeit für eine Pause! ⏰', {
          body: `Du arbeitest seit ${(breakReminderMinutes / 60).toFixed(1)} Stunden. Gesetzlich ist eine Pause vorgeschrieben.`,
          tag: 'break-reminder',
        });
      }, delay);

      return timeoutId;
    }

    return null;
  };

  const sendClockOutReminder = () => {
    sendNotification('Nicht vergessen auszustempeln! 👋', {
      body: 'Du hast möglicherweise vergessen, deine Arbeitszeit zu beenden.',
      tag: 'clock-out-reminder',
    });
  };

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    scheduleBreakReminder,
    sendClockOutReminder,
  };
};
