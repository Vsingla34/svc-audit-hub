import { useState } from 'react';
import { messaging } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function NotificationDebugPanel() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev]);
  };

  const runDiagnostics = async () => {
    setLogs([]);
    log('🔍 Starting diagnostics...');

    // 1. Browser support
    if (!('Notification' in window)) {
      log('❌ FAIL: This browser does not support Notifications'); return;
    }
    log('✅ Browser supports Notifications');

    if (!('serviceWorker' in navigator)) {
      log('❌ FAIL: This browser does not support Service Workers'); return;
    }
    log('✅ Browser supports Service Workers');

    // 2. Permission status
    log(`🔔 Notification permission: ${Notification.permission}`);
    if (Notification.permission !== 'granted') {
      log('❌ FAIL: Permission is not granted. Click "Request Permission" below.');
      return;
    }

    // 3. Service worker
    try {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
      log(`✅ SW registered. State: ${reg.active?.state || 'no active worker'}`);
      await navigator.serviceWorker.ready;
      log('✅ SW is ready');
    } catch (e: any) {
      log(`❌ FAIL: SW registration failed: ${e.message}`); return;
    }

    // 4. FCM Token
    try {
      const vapidKey = import.meta.env.VITE_FIREBASE_KEY;
      if (!vapidKey) { log('❌ FAIL: VITE_FIREBASE_KEY is not set in .env'); return; }
      log('✅ VAPID key found');

      const reg = await navigator.serviceWorker.ready;
      const token = await getToken(messaging!, { vapidKey, serviceWorkerRegistration: reg });

      if (!token) { log('❌ FAIL: getToken() returned empty. Check Firebase project config.'); return; }
      log(`✅ FCM Token obtained: ${token.substring(0, 20)}...`);

      // 5. Check what token is saved in DB
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('fcm_token')
          .eq('id', user.id)
          .single();

        if (!profile?.fcm_token) {
          log('❌ DB: No FCM token saved in profiles table for this user');
        } else if (profile.fcm_token !== token) {
          log('⚠️ DB: Token in DB is DIFFERENT from this device\'s token!');
          log('   → This means notifications are going to a different device');
          log(`   DB token starts with: ${profile.fcm_token.substring(0, 20)}...`);
          log(`   This device token starts with: ${token.substring(0, 20)}...`);
        } else {
          log('✅ DB: Token in DB matches this device. Token is correct.');
        }
      }
    } catch (e: any) {
      log(`❌ FAIL: FCM token error: ${e.message}`); return;
    }

    // 6. Test native notification via SW message
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          payload: {
            title: '✅ Test Notification',
            body: 'If you see this banner, the pipeline works!',
            url: '/',
            assignmentId: 'test'
          }
        });
        log('✅ TEST: Sent showNotification command to SW → You should see a phone banner NOW');
      } else {
        log('❌ FAIL: SW has no active worker to post message to');
      }
    } catch (e: any) {
      log(`❌ FAIL: postMessage to SW failed: ${e.message}`);
    }
  };

  const requestPermission = async () => {
    const result = await Notification.requestPermission();
    setLogs(prev => [`[Permission] Result: ${result}`, ...prev]);
  };

  const saveTokenToDB = async () => {
    try {
      const vapidKey = import.meta.env.VITE_FIREBASE_KEY;
      const reg = await navigator.serviceWorker.ready;
      const token = await getToken(messaging!, { vapidKey, serviceWorkerRegistration: reg });
      if (token && user) {
        await supabase.from('profiles').update({ fcm_token: token }).eq('id', user.id);
        log(`✅ Token saved to DB: ${token.substring(0, 20)}...`);
      }
    } catch (e: any) {
      log(`❌ Failed to save token: ${e.message}`);
    }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
      background: '#1e1e1e', color: '#d4d4d4', borderRadius: 12,
      padding: 16, width: 340, fontFamily: 'monospace', fontSize: 12,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)', maxHeight: '80vh',
      display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <div style={{ fontWeight: 'bold', fontSize: 14, color: '#fff' }}>
        🔧 Notification Debugger
      </div>
      <NotificationDebugPanel />

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={runDiagnostics} style={btnStyle('#4338CA')}>
          Run Diagnostics
        </button>
        <button onClick={requestPermission} style={btnStyle('#16a34a')}>
          Request Permission
        </button>
        <button onClick={saveTokenToDB} style={btnStyle('#b45309')}>
          Re-save Token
        </button>
      </div>

      <div style={{
        background: '#111', borderRadius: 8, padding: 8,
        overflowY: 'auto', maxHeight: 300, display: 'flex',
        flexDirection: 'column', gap: 4
      }}>
        {logs.length === 0
          ? <span style={{ color: '#666' }}>Press "Run Diagnostics" to start...</span>
          : logs.map((l, i) => (
            <div key={i} style={{
              color: l.includes('❌') ? '#f87171'
                : l.includes('⚠️') ? '#fbbf24'
                : l.includes('✅') ? '#4ade80'
                : '#d4d4d4'
            }}>{l}</div>
          ))
        }
      </div>
    </div>
  );
}

const btnStyle = (bg: string): React.CSSProperties => ({
  background: bg, color: '#fff', border: 'none',
  borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
  fontSize: 11, fontFamily: 'monospace'
});