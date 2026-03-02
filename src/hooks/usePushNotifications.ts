import { useState, useEffect, useRef } from 'react';
import { messaging } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

// ── Shared SW registration helper ─────────────────────────────────────────────
// Always registers with updateViaCache: 'none' so the browser never serves a
// stale SW file from HTTP cache. Returns the ready registration.
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
  const hasFetchedRef = useRef(false);

  // ── On mount: read current permission and auto-sync token if already granted
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermissionStatus('unsupported');
      return;
    }
    setPermissionStatus(Notification.permission);

    if (Notification.permission === 'granted' && user && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      syncToken();
    }
  }, [user]);

  // ── Save/refresh the FCM token in Supabase ────────────────────────────────
  const syncToken = async () => {
    try {
      if (!messaging) return;
      const vapidKey = import.meta.env.VITE_FIREBASE_KEY;
      if (!vapidKey) { console.error('VITE_FIREBASE_KEY missing'); return; }

      const reg   = await getSwRegistration();
      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });

      if (token && user) {
        const { error } = await supabase.from('profiles').update({ fcm_token: token }).eq('id', user.id);
        if (error) console.error('Error saving FCM token:', error);
        else console.log('[FCM] Token synced');
      }
    } catch (err) {
      console.error('[FCM] syncToken failed:', err);
    }
  };

  // ── Ask for permission then save token ────────────────────────────────────
  const requestPermissionAndGetToken = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast.error('Your browser does not support push notifications.'); return;
    }
    if (!messaging) {
      toast.error('Notification service failed to initialize.'); return;
    }
    const vapidKey = import.meta.env.VITE_FIREBASE_KEY;
    if (!vapidKey) {
      toast.error('Notification configuration is missing.'); return;
    }

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);

    if (permission === 'granted') {
      try {
        const reg   = await getSwRegistration();
        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });

        if (token && user) {
          const { error } = await supabase.from('profiles').update({ fcm_token: token }).eq('id', user.id);
          if (error) { toast.error('Failed to save notification token.'); return; }
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

  // ── Foreground message handler ────────────────────────────────────────────
  // When the page IS focused, FCM does NOT show a system notification itself.
  // We must tell the SW to call showNotification() because:
  //   • Chrome Android blocks new Notification() from page context when foregrounded
  //   • Only SW-context showNotification() reliably appears in the system tray
  //
  // The SW's message handler uses event.waitUntil() to stay alive — this was
  // the missing piece causing silent failures on Android.
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, async (payload) => {
      console.log('[App] Foreground FCM message:', payload);

      const title        = payload.notification?.title || payload.data?.title || 'New Update';
      const body         = payload.notification?.body  || payload.data?.body  || '';
      const assignmentId = payload.data?.assignment_id;
      const targetUrl    = assignmentId ? `/assignment/${assignmentId}` : '/';

      // ── Route through SW so Android shows a real system notification ──────
      try {
        const reg = await navigator.serviceWorker.ready;

        if (reg.active) {
          reg.active.postMessage({
            type: 'SHOW_NOTIFICATION',
            payload: { title, body, url: targetUrl, assignmentId },
          });
        } else {
          // Fallback for desktop browsers where SW may not be active yet
          if (Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' });
          }
        }
      } catch (err) {
        console.error('[App] Failed to route notification through SW:', err);
      }

      // ── Always show in-app toast as well ──────────────────────────────────
      toast(title, {
        description: body,
        action: assignmentId
          ? { label: 'View', onClick: () => (window.location.href = targetUrl) }
          : undefined,
        duration: 6000,
      });
    });

    return () => unsubscribe();
  }, []);

  return { requestPermissionAndGetToken, permissionStatus };
}