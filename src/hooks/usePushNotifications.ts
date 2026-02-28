import { useState, useEffect, useRef } from 'react';
import { messaging } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermissionStatus('unsupported');
      return;
    }

    const currentPermission = Notification.permission;
    setPermissionStatus(currentPermission);

    // Auto-sync: if permission already granted on this device, silently refresh token
    if (currentPermission === 'granted' && user && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      syncToken();
    }
  }, [user]);

  const syncToken = async () => {
    try {
      if (!messaging) return;

      const vapidKey = import.meta.env.VITE_FIREBASE_KEY;
      if (!vapidKey) {
        console.error("VITE_FIREBASE_KEY is missing from environment variables");
        return;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });

      await navigator.serviceWorker.ready;

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration
      });

      if (token && user) {
        console.log("FCM Token synced for this device.");
        const { error } = await supabase
          .from('profiles')
          .update({ fcm_token: token })
          .eq('id', user.id);

        if (error) console.error("Error saving FCM token:", error);
      }
    } catch (error) {
      console.error("Failed to sync FCM token:", error);
    }
  };

  const requestPermissionAndGetToken = async () => {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        toast.error("Your browser does not support push notifications.");
        return;
      }

      if (!messaging) {
        toast.error("Notification service failed to initialize.");
        return;
      }

      const vapidKey = import.meta.env.VITE_FIREBASE_KEY;
      if (!vapidKey) {
        toast.error("Notification configuration is missing.");
        console.error("VITE_FIREBASE_KEY is not set");
        return;
      }

      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });

        await navigator.serviceWorker.ready;

        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: registration
        });

        if (token && user) {
          const { error } = await supabase
            .from('profiles')
            .update({ fcm_token: token })
            .eq('id', user.id);

          if (error) {
            toast.error("Failed to save notification token.");
            console.error("Error saving FCM token:", error);
            return;
          }

          toast.success("Notifications enabled! You'll be notified of new assignments.");
        } else {
          toast.error("Could not get notification token. Try again.");
        }
      } else if (permission === 'denied') {
        toast.error("Notifications blocked. Please enable them in your browser settings.");
      }
    } catch (error) {
      console.error("Failed to get FCM token:", error);
      toast.error("Failed to enable notifications.");
    }
  };

  // ✅ Handles notifications when app is OPEN (foreground)
  // Shows BOTH a native OS banner AND an in-app toast
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, async (payload) => {
      console.log('[App] Foreground message received:', payload);

      const title = payload.notification?.title || payload.data?.title || 'New Update';
      const body = payload.notification?.body || payload.data?.body || 'Check the app.';
      const assignmentId = payload.data?.assignment_id;
      const targetUrl = assignmentId ? `/assignments/${assignmentId}` : '/';

      // 1. ✅ Show native OS notification banner via service worker
      //    This makes the phone banner drop down even while the app is open
      try {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          vibrate: [200, 100, 200],
          requireInteraction: false,
          data: { url: targetUrl }
        });
      } catch (err) {
        console.error('[App] Failed to show native notification:', err);
      }

      // 2. ✅ Also show in-app toast as a secondary indicator
      toast(title, {
        description: body,
        action: assignmentId
          ? {
              label: 'View',
              onClick: () => window.location.href = targetUrl
            }
          : undefined,
        duration: 6000
      });
    });

    return () => unsubscribe();
  }, []);

  return { requestPermissionAndGetToken, permissionStatus };
}