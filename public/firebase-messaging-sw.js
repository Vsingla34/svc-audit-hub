importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');


const firebaseConfig = {
  apiKey:            "AIzaSyB_Bv6PVbPuThrXImzh5vtKfX6NKsiZqqw",
  authDomain:        "audit-flow-stockcheck360.firebaseapp.com",
  projectId:         "audit-flow-stockcheck360",
  storageBucket:     "audit-flow-stockcheck360.firebasestorage.app",
  messagingSenderId: "17452550996",
  appId:             "1:17452550996:web:433fab03a3c780604c96c1",
};
// ─────────────────────────────────────────────────────────────────────────────

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();


function showNotif(title, body, url, tag) {
  return self.registration.showNotification(title || 'New Notification', {
    body:               body || '',
    icon:               '/favicon.ico',
    badge:              '/favicon.ico',
    tag:                tag || 'default',
    renotify:           true,
    requireInteraction: false,
    vibrate:            [200, 100, 200],
    data:               { url: url || '/' },
  });
}


messaging.onBackgroundMessage((payload) => {
  console.log('[SW] onBackgroundMessage:', payload);
  const title        = payload.notification?.title || payload.data?.title || 'New Notification';
  const body         = payload.notification?.body  || payload.data?.body  || '';
  const url          = payload.data?.url || '/';
  const assignmentId = payload.data?.assignment_id;
  return showNotif(title, body, url, assignmentId ? `assignment-${assignmentId}` : 'fcm-bg');
});

self.addEventListener('message', (event) => {
  console.log('[SW] message received:', event.data);

  if (!event.data || event.data.type !== 'SHOW_NOTIFICATION') return;

  const { title, body, url, assignmentId } = event.data.payload || {};
  const tag = assignmentId ? `assignment-${assignmentId}` : 'foreground-notif';

  event.waitUntil(
    showNotif(title, body, url, tag)
      .then(() => console.log('[SW] showNotification done'))
      .catch((e)  => console.error('[SW] showNotification error:', e))
  );
});

// ── 3. Notification click ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── 4. Activate immediately (critical for first-install) ─────────────────────
self.addEventListener('install',  (e) => { console.log('[SW] install');  e.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', (e) => { console.log('[SW] activate'); e.waitUntil(self.clients.claim()); });