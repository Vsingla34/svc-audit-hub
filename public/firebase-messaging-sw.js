importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// ✅ Force new SW to activate immediately without waiting for old one to die
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// ✅ Take control of all open tabs immediately on activation
self.addEventListener('activate', (event) => {
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

// ✅ BACKGROUND: Fires when app is closed or browser tab is not active
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  // Browser handles display automatically when notification block is present
  // Only manually show for data-only messages
  if (payload.notification) return;

  return self.registration.showNotification(
    payload.data?.title || 'StockCheck360',
    {
      body: payload.data?.body || 'You have a new notification.',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      data: {
        url: payload.data?.assignment_id
          ? `/assignments/${payload.data.assignment_id}`
          : '/'
      }
    }
  );
});

// ✅ FOREGROUND: React app posts here so SW can show native OS banner
// (showNotification from page context is unreliable on Android Chrome)
self.addEventListener('message', (event) => {
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

// ✅ Handle notification tap — open or focus the app
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