import { useState, useEffect, useRef } from 'react';
import { messaging } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

async function getSwRegistration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
  return navigator.serviceWorker.ready;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  
  // 🔥 FIX: Track the actual User ID, not just a true/false boolean
  // This ensures that if you log out and log into a different account, it forces a resync!
  const syncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermissionStatus('unsupported');
      return;
    }
    setPermissionStatus(Notification.permission);

    // 🔥 FIX: Check if the current user ID matches the one we already synced
    if (Notification.permission === 'granted' && user && syncedUserRef.current !== user.id) {
      syncedUserRef.current = user.id;
      syncToken();
    }
  }, [user]);

  const syncToken = async () => {
    try {
      const msg = await messaging();
      if (!msg) return;
      
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (!vapidKey) { console.error('VITE_FIREBASE_VAPID_KEY missing'); return; }

      const reg = await getSwRegistration();
      const token = await getToken(msg, { vapidKey, serviceWorkerRegistration: reg });

      if (token && user) {
        const { error } = await supabase.from('profiles').update({ fcm_token: token }).eq('id', user.id);
        if (error) console.error('Error saving FCM token:', error);
        else console.log('🎉 [FCM] Token synced successfully for user:', user.id);
      }
    } catch (err) {
      console.error('[FCM] syncToken failed:', err);
    }
  };

  const requestPermissionAndGetToken = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast.error('Your browser does not support push notifications.'); return;
    }
    
    const msg = await messaging();
    if (!msg) {
      toast.error('Notification service failed to initialize.'); return;
    }
    
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      toast.error('Notification configuration is missing.'); return;
    }

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);

    if (permission === 'granted') {
      try {
        const reg = await getSwRegistration();
        const token = await getToken(msg, { vapidKey, serviceWorkerRegistration: reg });

        if (token && user) {
          const { error } = await supabase.from('profiles').update({ fcm_token: token }).eq('id', user.id);
          if (error) { toast.error('Failed to save notification token.'); return; }
          
          // Force update the ref so it doesn't double-sync later
          syncedUserRef.current = user.id;
          toast.success('Notifications enabled!');
        } else {
          toast.error('Could not get notification token. Try again.');
        }
      } catch (err) {
        console.error('[FCM] requestPermission flow failed:', err);
        toast.error('Failed to enable notifications.');
      }
    } else if (permission === 'denied') {
      toast.error('Notifications blocked. Enable them in your browser settings.');
    }
  };

  useEffect(() => {
    const setupForegroundListener = async () => {
      const msg = await messaging();
      if (!msg) return;

      return onMessage(msg, async (payload) => {
        const title = payload.notification?.title || payload.data?.title || 'New Update';
        const body = payload.notification?.body || payload.data?.body || '';
        const assignmentId = payload.data?.assignment_id;
        const targetUrl = assignmentId ? `/assignment/${assignmentId}` : '/';

        try {
          const reg = await navigator.serviceWorker.ready;
          if (reg.active) {
            reg.active.postMessage({
              type: 'SHOW_NOTIFICATION',
              payload: { title, body, url: targetUrl, assignmentId },
            });
          } else {
            if (Notification.permission === 'granted') {
              new Notification(title, { body, icon: '/favicon.ico' });
            }
          }
        } catch (err) {
          console.error('[App] Failed to route notification through SW:', err);
        }

        toast(title, {
          description: body,
          action: assignmentId
            ? { label: 'View', onClick: () => (window.location.href = targetUrl) }
            : undefined,
          duration: 6000,
        });
      });
    };

    let unsubscribe: any;
    setupForegroundListener().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return { requestPermissionAndGetToken, permissionStatus };
}