import { createClient } from '@supabase/supabase-js';
import admin from 'firebase-admin';

// Initialize Firebase Admin securely using the JSON environment variable
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('Firebase admin initialization error:', error);
  }
}

export default async function handler(req, res) {
  // 1. Only allow POST requests (Supabase Webhooks send POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Extract notification from Supabase Webhook payload
    const payload = req.body;
    const notification = payload.record; 

    if (!notification || !notification.user_id) {
      return res.status(400).json({ error: 'Invalid payload - no notification record found' });
    }

    // 3. Connect to Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
       throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Look up the user's FCM Token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('fcm_token')
      .eq('id', notification.user_id)
      .single();

    if (profileError || !profile?.fcm_token) {
      console.log(`No FCM token found for user ${notification.user_id}`);
      return res.status(200).json({ message: 'User has no FCM token. Notification saved to DB only.' });
    }


    const message = {
      tokens: deviceTokens, 
      
      data: {
        title: String(notification.title || "New Update"),
        body: String(notification.message || "Check the app for details"),
        assignment_id: String(notification.related_assignment_id || "")
      }
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);

    return res.status(200).json({ success: true, messageId: response });

  } catch (error) {
    console.error('Error sending notification:', error);
    return res.status(500).json({ error: error.message });
  }
}