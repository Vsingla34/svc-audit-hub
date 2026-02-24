import { useState, useEffect } from 'react';
import { messaging, firebaseConfig } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const requestPermissionAndGetToken = async () => {
    try {
      if (!messaging) throw new Error("Firebase messaging not initialized");

      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        const vapidKey = import.meta.env.VITE_FIREBASE_KEY;

        // Pass the ENV config to the service worker securely via URL parameters
        const configStr = encodeURIComponent(JSON.stringify(firebaseConfig));
        const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?config=${configStr}`);

        // Get the token using the custom registered service worker
        const token = await getToken(messaging, { 
            vapidKey,
            serviceWorkerRegistration: registration 
        });

        if (token && user) {
          console.log("FCM Token obtained");
          
          const { error } = await supabase
            .from('profiles')
            .update({ fcm_token: token })
            .eq('id', user.id);

          if (error) {
            console.error("Error saving FCM token to Supabase:", error);
          }
        }
      } else {
        console.warn("Notification permission denied by user.");
      }
    } catch (error) {
      console.error("Failed to get FCM token:", error);
    }
  };

  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Received foreground message: ', payload);
      if (payload.notification) {
         toast(payload.notification.title, {
            description: payload.notification.body,
         });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { requestPermissionAndGetToken, permissionStatus };
}