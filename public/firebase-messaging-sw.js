importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// ✅ Force new SW to activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(clients.claim());
});

firebase.initializeApp({
  apiKey: "AIzaSyB_Bv6PVbPuThrXImzh5vtKfX6NKsiZqqw",
  authDomain: "audit-flow-stockcheck360.firebaseapp.com",
  projectId: "audit-flow-stockcheck360",
  storageBucket: "audit-flow-stockcheck360.firebasestorage.app",
  messagingSenderId: "17452550996",
  appId: "1:17452550996:web:433fab03a3c780604c96c1"
});

const messaging = firebase.messaging();

// ✅ RAW push event listener — this fires for ALL push events including
// the DevTools "Push" button test. Must be defined BEFORE Firebase's handler.
self.addEventListener('push', (event) => {
  console.log('[SW] Raw push event received:', event);

  let title = 'StockCheck360';
  let body = 'You have a new notification.';
  let url = '/';

  // Try to parse the push data if it exists
  if (event.data) {
    try {
      const data = event.data.json();
      console.log('[SW] Push data:', data);

      // Handle both FCM format and raw format
      title = data?.notification?.title || data?.data?.title || title;
      body = data?.notification?.body || data?.data?.body || body;
      const assignmentId = data?.data?.assignment_id;
      url = assignmentId ? `/assignments/${assignmentId}` : (data?.data?.url || '/');
    } catch (e) {
      // If not JSON, use the raw text as body
      body = event.data.text() || body;
    }
  }

  // ✅ Always show notification — this is what produces the OS banner
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      data: { url }
    })
  );
});

// Firebase background handler — only runs for FCM messages when app is closed
// Raw push listener above handles everything else
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] FCM background message:', payload);
  // Raw push listener above already showed the notification, so do nothing here
  // to avoid showing it twice
});

// ✅ FOREGROUND: React app posts here so SW shows native OS banner
self.addEventListener('message', (event) => {
  console.log('[SW] Message from page:', event.data);

  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, url, assignmentId } = event.data.payload;

    self.registration.showNotification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: assignmentId || 'default',
      renotify: true,
      data: { url: url || '/' }
    });
  }
});

// ✅ Handle notification tap
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return client.navigate(targetUrl);
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});