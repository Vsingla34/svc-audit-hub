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
        console.error("VITE_FIREBASE_KEY is missing");
        return;
      }

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      await navigator.serviceWorker.ready;

      const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

      if (token && user) {
        console.log("FCM Token synced.");
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
        return;
      }

      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
          scope: '/'
        });
        await navigator.serviceWorker.ready;

        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });

        if (token && user) {
          const { error } = await supabase
            .from('profiles')
            .update({ fcm_token: token })
            .eq('id', user.id);

          if (error) {
            toast.error("Failed to save notification token.");
            return;
          }
          toast.success("Notifications enabled!");
        } else {
          toast.error("Could not get notification token. Try again.");
        }
      } else if (permission === 'denied') {
        toast.error("Notifications blocked. Enable them in your browser settings.");
      }
    } catch (error) {
      console.error("Failed to get FCM token:", error);
      toast.error("Failed to enable notifications.");
    }
  };

  // ✅ Foreground message handler
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, async (payload) => {
      console.log('[App] Foreground message received:', payload);

      const title = payload.notification?.title || payload.data?.title || 'New Update';
      const body = payload.notification?.body || payload.data?.body || 'Check the app.';
      const assignmentId = payload.data?.assignment_id;
      const targetUrl = assignmentId ? `/assignments/${assignmentId}` : '/';

      // ✅ THE FIX: Post to the service worker so IT calls showNotification.
      // Calling showNotification from the page context is unreliable on Android
      // Chrome. The SW context always works because it's treated as a background process.
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.active) {
          registration.active.postMessage({
            type: 'SHOW_NOTIFICATION',
            payload: { title, body, url: targetUrl, assignmentId }
          });
        }
      }

      // Also show in-app toast
      toast(title, {
        description: body,
        action: assignmentId
          ? { label: 'View', onClick: () => window.location.href = targetUrl }
          : undefined,
        duration: 6000
      });
    });

    return () => unsubscribe();
  }, []);

  return { requestPermissionAndGetToken, permissionStatus };
}