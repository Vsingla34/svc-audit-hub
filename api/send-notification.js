import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const notification = req.body?.record;

    if (!notification?.user_id) {
      return res.status(400).json({ error: 'Invalid payload - no notification record found' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('fcm_token')
      .eq('id', notification.user_id)
      .single();

    if (profileError || !profile?.fcm_token) {
      console.log(`No FCM token found for user ${notification.user_id}`);
      return res.status(200).json({ message: 'No FCM token found. Notification saved to DB only.' });
    }

    const message = {
      token: profile.fcm_token,

      // ✅ This is what actually shows on the phone/browser
      notification: {
        title: notification.title || "New Assignment Available",
        body: notification.message || "Check the app for details"
      },

      // ✅ Pass data along for click handling (opening correct page)
      data: {
        assignment_id: String(notification.related_assignment_id || ""),
        title: String(notification.title || ""),
        body: String(notification.message || "")
      },

      // ✅ Web push specific config
      webpush: {
        headers: {
          Urgency: "high",  // Don't let browser delay delivery
          TTL: "86400"      // Keep trying for 24 hours if browser is offline
        },
        notification: {
          title: notification.title || "New Assignment Available",
          body: notification.message || "Check the app for details",
          icon: "/favicon.ico",       // Shown in the notification banner
          badge: "/favicon.ico",      // Small icon in Android status bar
          requireInteraction: false,  // Don't force user to manually dismiss
          vibrate: [200, 100, 200],   // Vibration pattern on mobile
          data: {
            assignment_id: String(notification.related_assignment_id || ""),
            url: notification.related_assignment_id
              ? `/assignments/${notification.related_assignment_id}`
              : "/"
          }
        },
        fcm_options: {
          link: notification.related_assignment_id
            ? `/assignments/${notification.related_assignment_id}`
            : "/"
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent push notification:', response);

    return res.status(200).json({ success: true, messageId: response });

  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ error: error.message });
  }
}