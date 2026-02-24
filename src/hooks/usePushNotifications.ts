import { useState, useEffect, useRef } from 'react';
import { messaging, firebaseConfig } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { user } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // 1. Check if the device/browser actually supports Push Notifications
    if (!('Notification' in window)) {
      setPermissionStatus('unsupported');
      return;
    }

    // 2. Read the current browser permission
    const currentPermission = Notification.permission;
    setPermissionStatus(currentPermission);

    // 3. THE AUTO-SYNC: If this new device already has permission granted, 
    // we silently grab its token and overwrite the database to make it the active device!
    if (currentPermission === 'granted' && user && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      requestPermissionAndGetToken();
    }
  }, [user]);

  const requestPermissionAndGetToken = async () => {
    try {
      if (!('Notification' in window)) {
        toast.error("Your device/browser does not support push notifications.");
        return;
      }

      if (!messaging) throw new Error("Firebase messaging not initialized");

      const permission = await Notification.requestPermission();
      setPermissionStatus(permission);

      if (permission === 'granted') {
        const vapidKey = import.meta.env.VITE_FIREBASE_KEY;

        // Pass config securely to the background worker
        const configStr = encodeURIComponent(JSON.stringify(firebaseConfig));
        const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?config=${configStr}`);

        // Generate the token for THIS specific device
        const token = await getToken(messaging, { 
            vapidKey,
            serviceWorkerRegistration: registration 
        });

        if (token && user) {
          console.log("FCM Token obtained for this device!");
          
          // OVERWRITE the old device's token in the profiles table
          const { error } = await supabase
            .from('profiles')
            .update({ fcm_token: token })
            .eq('id', user.id);

          if (error) {
            console.error("Error saving FCM token to Supabase:", error);
          }
        }
      } else if (permission === 'denied') {
        toast.error("Notifications are blocked in your browser settings.");
      }
    } catch (error) {
      console.error("Failed to get FCM token:", error);
    }
  };

  // Listen for active foreground messages
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      if (payload.notification) {
         toast(payload.notification.title, {
            description: payload.notification.body,
         });
      }
    });

    return () => unsubscribe();
  }, []);

  return { requestPermissionAndGetToken, permissionStatus };
}